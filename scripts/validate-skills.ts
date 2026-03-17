#!/usr/bin/env tsx
/**
 * Skill Validation Script
 * 
 * Validates that all skills in the repository follow the standard format:
 * - Each skill directory contains a SKILL.md file
 * - SKILL.md has required frontmatter (name, description)
 * - Skill directories follow naming conventions
 */

import fs from 'fs';
import path from 'path';

interface SkillValidationResult {
  path: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface SkillFrontmatter {
  name?: string;
  description?: string;
  [key: string]: unknown;
}

function extractFrontmatter(content: string): SkillFrontmatter {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return {};
  }

  const frontmatterString = match[1];
  const frontmatter: SkillFrontmatter = {};

  frontmatterString.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim().replace(/^['"]|['"]$/g, '');
      frontmatter[key.trim()] = value;
    }
  });

  return frontmatter;
}

function validateSkillDirectory(skillPath: string): SkillValidationResult {
  const result: SkillValidationResult = {
    path: skillPath,
    valid: true,
    errors: [],
    warnings: [],
  };

  const skillMdPath = path.join(skillPath, 'SKILL.md');

  // Check if SKILL.md exists
  if (!fs.existsSync(skillMdPath)) {
    result.errors.push('Missing SKILL.md file');
    result.valid = false;
    return result;
  }

  // Read and validate SKILL.md
  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const frontmatter = extractFrontmatter(content);

  // Check required frontmatter
  if (!frontmatter.name) {
    result.errors.push('Missing required frontmatter: name');
    result.valid = false;
  } else if (!/^[a-z0-9-]+$/.test(frontmatter.name)) {
    result.errors.push('Skill name must be lowercase with hyphens (e.g., my-skill-name)');
    result.valid = false;
  }

  if (!frontmatter.description) {
    result.errors.push('Missing required frontmatter: description');
    result.valid = false;
  } else if (frontmatter.description.length < 10) {
    result.warnings.push('Description should be more detailed (at least 10 characters)');
  }

  // Check for skill content
  const contentWithoutFrontmatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
  if (contentWithoutFrontmatter.trim().length < 50) {
    result.warnings.push('Skill content seems too short');
  }

  // Check directory naming
  const dirName = path.basename(skillPath);
  if (dirName !== frontmatter.name && frontmatter.name) {
    result.warnings.push(`Directory name "${dirName}" doesn't match skill name "${frontmatter.name}"`);
  }

  return result;
}

function findSkillDirectories(basePath: string): string[] {
  const skillDirs: string[] = [];

  function searchDirectory(dirPath: string) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const fullPath = path.join(dirPath, entry.name);
        
        // Check if this directory contains SKILL.md
        if (fs.existsSync(path.join(fullPath, 'SKILL.md'))) {
          skillDirs.push(fullPath);
        }
        
        // Recursively search subdirectories
        searchDirectory(fullPath);
      }
    }
  }

  searchDirectory(basePath);
  return skillDirs;
}

function main() {
  const rootDir = process.cwd();
  const skillDirs = findSkillDirectories(rootDir);

  console.log(`Found ${skillDirs.length} skill directories\n`);

  const results: SkillValidationResult[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const skillDir of skillDirs) {
    const result = validateSkillDirectory(skillDir);
    results.push(result);
    
    if (result.errors.length > 0) totalErrors += result.errors.length;
    if (result.warnings.length > 0) totalWarnings += result.warnings.length;
  }

  // Print results
  console.log('Validation Results:\n');
  console.log('='.repeat(60));

  for (const result of results) {
    const status = result.valid ? '✓' : '✗';
    console.log(`\n${status} ${result.path}`);
    
    for (const error of result.errors) {
      console.log(`  ERROR: ${error}`);
    }
    
    for (const warning of result.warnings) {
      console.log(`  WARNING: ${warning}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\nSummary: ${results.filter(r => r.valid).length}/${results.length} skills valid`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log(`Total Warnings: ${totalWarnings}\n`);

  // Exit with error code if any skills are invalid
  if (totalErrors > 0) {
    process.exit(1);
  }
}

main();
