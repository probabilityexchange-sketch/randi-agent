import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

export interface AnalysisResult {
  filepath: string;
  issues: Issue[];
  metrics: Metrics;
}

export interface Issue {
  type: 'lint' | 'format' | 'test' | 'documentation' | 'complexity';
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
  ruleId?: string;
}

export interface Metrics {
  lines: number;
  statements: number;
  branches: number;
  functions: number;
}

/**
 * Analyze code for issues and metrics
 */
export class CodeAnalyzer {
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = resolve(rootDir);
  }

  /**
   * Analyze a file or directory for issues
   */
  async analyze(targetPath: string): Promise<AnalysisResult[]> {
    const fullPath = join(this.rootDir, targetPath);
    
    if (!existsSync(fullPath)) {
      throw new Error(`Path does not exist: ${targetPath}`);
    }

    const results: AnalysisResult[] = [];
    
    const files = this.getTypeScriptFiles(fullPath);
    
    for (const file of files) {
      const fileResult = await this.analyzeFile(file);
      results.push(fileResult);
    }
    
    return results;
  }

  /**
   * Get all TypeScript/TSX files in a directory (or the file itself)
   */
  private getTypeScriptFiles(filePath: string): string[] {
    const stats = statSync(filePath);
    
    if (stats.isFile()) {
      if (this.isTypeScriptFile(filePath)) {
        return [filePath];
      }
      return [];
    }
    
    const files: string[] = [];
    const entries = readdirSync(filePath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.name.startsWith('.') || 
          entry.name === 'node_modules' || 
          entry.name === '.next' || 
          entry.name === 'out' || 
          entry.name === 'build' ||
          entry.name === 'coverage') {
        continue;
      }
      
      const fullPath = join(filePath, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...this.getTypeScriptFiles(fullPath));
      } else if (this.isTypeScriptFile(fullPath)) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private isTypeScriptFile(filePath: string): boolean {
    return filePath.endsWith('.ts') || filePath.endsWith('.tsx');
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(filePath: string): Promise<AnalysisResult> {
    const relativePath = relative(this.rootDir, filePath);
    
    // Run ESLint on the file
    const lintIssues = this.runLint(filePath);
    
    // Check formatting with Prettier
    const formatIssues = this.checkFormat(filePath);
    
    // Get test coverage info (if it's a test file, skip)
    const metrics = this.isTestFile(filePath) 
      ? this.getDefaultMetrics() 
      : this.getCoverageMetrics(filePath);
    
    // Check for documentation issues
    const docIssues = this.checkDocumentation(filePath);
    
    const allIssues = [
      ...lintIssues,
      ...formatIssues,
      ...docIssues
    ];
    
    return {
      filepath: relativePath,
      issues: allIssues,
      metrics
    };
  }

  /**
   * Run ESLint on a file and parse results
   */
  private runLint(filePath: string): Issue[] {
    try {
      // Use npx eslint with JSON format
      const output = execSync(`npx eslint "${filePath}" --format json`, { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'] 
      });
      
      const results = JSON.parse(output);
      const issues: Issue[] = [];
      
      for (const result of results) {
        for (const message of result.messages) {
          issues.push({
            type: 'lint',
            severity: message.severity === 2 ? 'error' : 'warning',
            message: message.message,
            line: message.line,
            column: message.column,
            ruleId: message.ruleId
          });
        }
      }
      
      return issues;
    } catch (error) {
      // If ESLint exits with error code (issues found), we still want to parse output
      if ((error as any).stdout) {
        try {
          const output = (error as any).stdout.toString();
          const results = JSON.parse(output);
          const issues: Issue[] = [];
          
          for (const result of results) {
            for (const message of result.messages) {
              issues.push({
                type: 'lint',
                severity: message.severity === 2 ? 'error' : 'warning',
                message: message.message,
                line: message.line,
                column: message.column,
                ruleId: message.ruleId
              });
            }
          }
          
          return issues;
        } catch (parseError) {
          // If we can't parse, return empty
          return [];
        }
      }
      return [];
    }
  }

  /**
   * Check if file is formatted correctly with Prettier
   */
  private checkFormat(filePath: string): Issue[] {
    try {
      // Use npx prettier --check
      execSync(`npx prettier --check "${filePath}"`, { 
        stdio: 'ignore' 
      });
      return []; // No issues if it passes
    } catch (error) {
      // Prettier failed - file is not formatted
      return [{
        type: 'format',
        severity: 'error',
        message: 'File is not formatted according to Prettier standards'
      }];
    }
  }

  /**
   * Get test coverage metrics for a file
   */
  private getCoverageMetrics(filePath: string): Metrics {
    try {
      // We would normally parse coverage reports, but for simplicity
      // we'll return default metrics and note that full coverage analysis
      // requires running the test suite
      return this.getDefaultMetrics();
    } catch {
      return this.getDefaultMetrics();
    }
  }

  /**
   * Check for documentation issues
   */
  private checkDocumentation(filePath: string): Issue[] {
    const issues: Issue[] = [];
    
    try {
      const content = require('fs').readFileSync(filePath, 'utf8');
      
      // Check for missing JSDoc on exported functions
      if (this.isTypeScriptFile(filePath)) {
        const jsdocIssues = this.checkForMissingJSDoc(content);
        issues.push(...jsdocIssues.map(issue => ({
          ...issue,
          type: 'documentation'
        })));
      }
    } catch (error) {
      // If we can't read the file, skip documentation check
    }
    
    return issues;
  }

  /**
   * Check for missing JSDoc comments on exported functions
   */
  private checkForMissingJSDoc(content: string): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');
    
    // Simple regex to find exported functions without preceding JSDoc
    // This is a simplified check - a real implementation would use AST
    const exportFuncPattern = /^export\s+(?:async\s+)?function\s+(\w+)\s*\(/gm;
    let match;
    
    while ((match = exportFuncPattern.exec(content)) !== null) {
      const lineNum = content.substr(0, match.index).split('\n').length;
      const lineContent = lines[lineNum - 1];
      
      // Check if there's a JSDoc comment on the line before
      let hasJSDoc = false;
      for (let i = lineNum - 2; i >= 0 && i >= lineNum - 5; i--) {
        if (lines[i].trim().startsWith('/**')) {
          hasJSDoc = true;
          break;
        }
        if (lines[i].trim() && !lines[i].trim().startsWith('*') && !lines[i].trim().startsWith('/')) {
          break;
        }
      }
      
      if (!hasJSDoc) {
        issues.push({
          severity: 'warning',
          message: `Exported function '${match[1]}' is missing JSDoc documentation`,
          line: lineNum
        });
      }
    }
    
    return issues;
  }

  /**
   * Check if a file is a test file
   */
  private isTestFile(filePath: string): boolean {
    return filePath.endsWith('.test.ts') || filePath.endsWith('.spec.ts');
  }

  /**
   * Get default metrics when we can't compute real ones
   */
  private getDefaultMetrics(): Metrics {
    return {
      lines: 0,
      statements: 0,
      branches: 0,
      functions: 0
    };
  }
}
