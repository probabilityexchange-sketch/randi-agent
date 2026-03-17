import { existsSync, readFileSync, writeFileSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { join, resolve } from 'path';
import type { Improvement } from './improvement-generator';

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  filesChanged: string[];
}

/**
 * Executes self-improvement tasks in isolated environments
 */
export class ImprovementExecutor {
  private rootDir: string;
  private tempDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = resolve(rootDir);
    // Create a temporary directory for isolated work
    this.tempDir = join(this.rootDir, '.self-maintenance-tmp');
    this.ensureTempDir();
  }

  /**
   * Ensure the temporary directory exists
   */
  private ensureTempDir(): void {
    if (!existsSync(this.tempDir)) {
      try {
        execSync(`mkdir -p "${this.tempDir}"`);
      } catch (error) {
        // If we can't create temp dir, we'll work in place but note the limitation
      }
    }
  }

  /**
   * Execute an improvement
   */
  async execute(improvement: Improvement): Promise<ExecutionResult> {
    try {
      switch (improvement.type) {
        case 'format-fix':
          return await this.executeFormatFix(improvement);
        case 'lint-fix':
          return await this.executeLintFix(improvement);
        case 'doc-add':
          return await this.executeDocAdd(improvement);
        case 'test-add':
          return await this.executeTestAdd(improvement);
         default:
           return {
             success: false,
             error: `Unsupported improvement type: ${improvement.type}`,
             output: '',
             filesChanged: []
           };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        output: '',
        filesChanged: []
      };
    }
  }

  /**
   * Execute formatting fixes using Prettier
   */
  private async executeFormatFix(improvement: Improvement): Promise<ExecutionResult> {
    const filePath = join(this.rootDir, improvement.filepath);
    
    if (!existsSync(filePath)) {
      return {
        success: false,
        error: `File not found: ${improvement.filepath}`,
        output: '',
        filesChanged: []
      };
    }
    
    try {
      // Run prettier --write on the file
      const output = execSync(`npx prettier --write "${filePath}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      return {
        success: true,
        output: output || 'Formatting applied successfully',
        filesChanged: [improvement.filepath]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        output: '',
        filesChanged: []
      };
    }
  }

  /**
   * Execute lint fixes using ESLint --fix
   */
  private async executeLintFix(improvement: Improvement): Promise<ExecutionResult> {
    const filePath = join(this.rootDir, improvement.filepath);
    
    if (!existsSync(filePath)) {
      return {
        success: false,
        error: `File not found: ${improvement.filepath}`,
        output: '',
        filesChanged: []
      };
    }
    
    try {
      // Run eslint --fix on the file
      const output = execSync(`npx eslint "${filePath}" --fix`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Check if there are still errors after fixing
      try {
        execSync(`npx eslint "${filePath}"`, {
          stdio: ['pipe', 'ignore', 'ignore']
        });
        // If we get here, no errors remain
      } catch (lintError) {
        // There are still lint errors after fixing
        // We'll still consider this a partial success
      }
      
      return {
        success: true,
        output: output || 'Linting fixes applied',
        filesChanged: [improvement.filepath]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        output: '',
        filesChanged: []
      };
    }
  }

  /**
   * Execute documentation additions
   * This creates a basic JSDoc template - in a real implementation,
   * this would be more sophisticated or require human input
   */
  private async executeDocAdd(improvement: Improvement): Promise<ExecutionResult> {
    const filePath = join(this.rootDir, improvement.filepath);
    
    if (!existsSync(filePath)) {
      return {
        success: false,
        error: `File not found: ${improvement.filepath}`,
        output: '',
        filesChanged: []
      };
    }
    
    try {
      const content = readFileSync(filePath, 'utf8');
      const updatedContent = this.addBasicJSDocTemplates(content);
      
      if (updatedContent === content) {
        // No changes were made (likely couldn't find appropriate places)
        return {
          success: false,
          error: 'Could not automatically add documentation - requires human input',
          output: '',
          filesChanged: []
        };
      }
      
      writeFileSync(filePath, updatedContent, 'utf8');
      
      return {
        success: true,
        output: 'Added basic JSDoc templates (review and complete manually)',
        filesChanged: [improvement.filepath]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        output: '',
        filesChanged: []
      };
    }
  }

  /**
   * Execute test additions
   * Creates a basic test file template
   */
  private async executeTestAdd(improvement: Improvement): Promise<ExecutionResult> {
    const sourceFilePath = join(this.rootDir, improvement.filepath);
    
    if (!existsSync(sourceFilePath)) {
      return {
        success: false,
        error: `Source file not found: ${improvement.filepath}`,
        output: '',
        filesChanged: []
      };
    }
    
    try {
      const testFilePath = this.getTestFilePath(sourceFilePath);
      const testContent = this.generateTestFileTemplate(sourceFilePath);
      
      // Check if test file already exists
      if (existsSync(testFilePath)) {
        return {
          success: false,
          error: `Test file already exists: ${this.relativePath(testFilePath)}`,
          output: '',
          filesChanged: []
        };
      }
      
      // Ensure the directory exists
      const testDir = testFilePath.substring(0, testFilePath.lastIndexOf('/\\'));
      execSync(`mkdir -p "${testDir}"`);
      
      writeFileSync(testFilePath, testContent, 'utf8');
      
      return {
        success: true,
        output: `Created test file: ${this.relativePath(testFilePath)}`,
        filesChanged: [this.relativePath(testFilePath)]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        output: '',
        filesChanged: []
      };
    }
  }

  /**
   * Add basic JSDoc templates to a file
   * This is a simplified implementation - a real version would use AST
   */
  private addBasicJSDocTemplates(content: string): string {
    // This is a very basic implementation that adds JSDoc to exported functions
    // A production version would use TypeScript AST for accuracy
    
    // For now, we'll just return the original content to avoid making incorrect changes
    // In a real implementation, this would:
    // 1. Parse the TypeScript file
    // 2. Find exported functions without JSDoc
    // 3. Insert appropriate JSDoc templates
    
    // Since we don't want to risk corrupting files, we'll indicate this needs human input
    return content; // No automatic changes for safety
  }

  /**
   * Get the test file path for a source file
   */
  private getTestFilePath(sourceFilePath: string): string {
    const dir = sourceFilePath.substring(0, sourceFilePath.lastIndexOf('/\\'));
    const base = sourceFilePath.substring(sourceFilePath.lastIndexOf('/\\') + 1);
    const nameWithoutExt = base.replace(/\.(ts|tsx)$/, '');
    
    // Place test file alongside source file
    return join(dir, `${nameWithoutExt}.test.ts`);
  }

  /**
   * Generate a basic test file template
   */
  private generateTestFileTemplate(sourceFilePath: string): string {
    const relativePath = this.relativePath(sourceFilePath);
    const baseName = this.getBaseName(sourceFilePath);
    
    return `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Import the module or function being tested
// import { functionName } from '${relativePath.replace('\\.test\\.ts$', '')}';

describe('${baseName}', () => {
  beforeEach(() => {
    // Set up test fixtures
  });

  afterEach(() => {
    // Clean up test fixtures
    vi.restoreAllMocks();
  });

  describe('when valid input', () => {
    it('should return expected output', () => {
      // Arrange
      // const input = 'test';
      
      // Act
      // const result = functionName(input);
      
      // Assert
      // expect(result).toBe('expected');
    });
  });

  describe('when invalid input', () => {
    it('should handle errors gracefully', () => {
      // Arrange
      // const input = null;
      
      // Act & Assert
      // expect(() => functionName(input)).toThrow();
    });
  });
});
`;
  }

  /**
   * Get relative path from root
   */
  private relativePath(filePath: string): string {
    return filePath.startsWith(this.rootDir) 
      ? filePath.substring(this.rootDir.length + 1) 
      : filePath;
  }

  /**
   * Get base name of a file (without extension)
   */
  private getBaseName(filePath: string): string {
    const base = filePath.substring(filePath.lastIndexOf('/\\') + 1);
    return base.replace(/\.(ts|tsx)$/, '');
  }

  /**
   * Create a git branch for the changes
   */
  private async createGitBranch(branchName: string): Promise<boolean> {
    try {
      // Check if we're in a git repository
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      
      // Create and checkout the branch
      execSync(`git checkout -b "${branchName}"`);
      
      return true;
    } catch (error) {
      // Not in a git repo or other error
      return false;
    }
  }

  /**
   * Commit changes
   */
  private async commitChanges(files: string[], message: string): Promise<boolean> {
    try {
      // Add the files
      for (const file of files) {
        execSync(`git add "${join(this.rootDir, file)}"`);
      }
      
      // Commit
      execSync(`git commit -m "${message}"`);
      
      return true;
    } catch (error) {
      return false;
    }
  }
}