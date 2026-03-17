import { AnalysisResult } from './analyzer';

interface Improvement {
  filepath: string;
  type: 'lint-fix' | 'format-fix' | 'test-add' | 'doc-add' | 'refactor';
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedEffort: 'small' | 'medium' | 'large'; // in hours
  prerequisites: string[];
  automatable: boolean;
  commitMessage: string;
  branchName: string;
}

interface ImprovementPlan {
  improvements: Improvement[];
  summary: {
    total: number;
    highPriority: number;
    automatable: number;
    estimatedTotalEffort: string; // e.g., "2-4 hours"
  };
  recommendations: string[];
}

/**
 * Generates improvement plans based on code analysis results
 */
export class ImprovementGenerator {
  /**
   * Generate improvement plan from analysis results
   */
  generateImprovements(results: AnalysisResult[]): ImprovementPlan {
    const improvements: Improvement[] = [];
    
    for (const result of results) {
      const fileImprovements = this.generateFileImprovements(result);
      improvements.push(...fileImprovements);
    }
    
    // Sort by priority and automatable potential
    improvements.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return Number(b.automatable) - Number(a.automatable);
    });
    
    // Generate summary
    const highPriority = improvements.filter(i => i.priority === 'high').length;
    const automatable = improvements.filter(i => i.automatable).length;
    const estimatedHours = improvements.reduce((total, imp) => {
      const hours = { small: 0.5, medium: 2, large: 8 }[imp.estimatedEffort];
      return total + (hours || 0);
    }, 0);
    
    const estimatedTotalEffort = estimatedHours < 2 
      ? '< 2 hours' 
      : estimatedHours < 8 
        ? `${Math.floor(estimatedHours)}-${Math.ceil(estimatedHours)} hours` 
        : `> ${Math.floor(estimatedHours / 8)} days`;
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(improvements);
    
    return {
      improvements,
      summary: {
        total: improvements.length,
        highPriority,
        automatable,
        estimatedTotalEffort
      },
      recommendations
    };
  }

  /**
   * Generate improvements for a single file
   */
  private generateFileImprovements(result: AnalysisResult[][0]): Improvement[] {
    const improvements: Improvement[] = [];
    const { filepath, issues, metrics } = result;
    
    // Group issues by type
    const lintIssues = issues.filter(i => i.type === 'lint');
    const formatIssues = issues.filter(i => i.type === 'format');
    const docIssues = issues.filter(i => i.type === 'documentation');
    
    // Generate formatting fixes (high priority, automatable)
    if (formatIssues.length > 0) {
      improvements.push({
        filepath,
        type: 'format-fix',
        description: `Fix formatting issues (${formatIssues.length} issues)`,
        priority: 'high',
        estimatedEffort: 'small',
        prerequisites: [],
        automatable: true,
        commitMessage: `format: fix formatting in ${filepath}`,
        branchName: `format/${this.sanitizeBranchName(filepath)}`
      });
    }
    
    // Generate lint fixes (varies by severity)
    const errorLintIssues = lintIssues.filter(i => i.severity === 'error');
    const warningLintIssues = lintIssues.filter(i => i.severity === 'warning');
    
    if (errorLintIssues.length > 0) {
      improvements.push({
        filepath,
        type: 'lint-fix',
        description: `Fix ${errorLintIssues.length} linting errors`,
        priority: 'high',
        estimatedEffort: 'small',
        prerequisites: [],
        automatable: true, // Many lint errors are auto-fixable
        commitMessage: `lint: fix errors in ${filepath}`,
        branchName: `lint-fix/${this.sanitizeBranchName(filepath)}`
      });
    }
    
    if (warningLintIssues.length > 0 && errorLintIssues.length === 0) {
      // Only suggest fixing warnings if no errors exist
      improvements.push({
        filepath,
        type: 'lint-fix',
        description: `Address ${warningLintIssues.length} linting warnings`,
        priority: 'medium',
        estimatedEffort: 'small',
        prerequisites: [],
        automatable: true,
        commitMessage: `lint: address warnings in ${filepath}`,
        branchName: `lint-warning/${this.sanitizeBranchName(filepath)}`
      });
    }
    
    // Generate documentation improvements
    if (docIssues.length > 0) {
      improvements.push({
        filepath,
        type: 'doc-add',
        description: `Add missing JSDoc documentation (${docIssues.length} locations)`,
        priority: 'medium',
        estimatedEffort: 'medium',
        prerequisites: [],
        automatable: false, // Requires human judgment for content
        commitMessage: `doc: add missing JSDoc in ${filepath}`,
        branchName: `doc/${this.sanitizeBranchName(filepath)}`
      });
    }
    
    // If no specific issues, suggest general improvements based on metrics
    if (improvements.length === 0 && metrics.lines > 0) {
      // Suggest adding tests if no test file exists
      if (!this.isLikelyTestFile(filepath) && !this.hasTestFile(filepath)) {
        improvements.push({
          filepath,
          type: 'test-add',
          description: `Add unit tests for ${filepath} (${metrics.lines} lines of code)`,
          priority: 'medium',
          estimatedEffort: 'medium',
          prerequisites: [],
          automatable: false,
          commitMessage: `test: add unit tests for ${filepath}`,
          branchName: `test/${this.sanitizeBranchName(filepath)}`
        });
      }
    }
    
    return improvements;
  }

  /**
   * Generate recommendations based on the improvement set
   */
  private generateRecommendations(improvements: Improvement[]): string[] {
    const recommendations: string[] = [];
    
    // Check for quick wins
    const quickWins = improvements.filter(i => 
      i.priority === 'high' && 
      i.automatable && 
      i.estimatedEffort === 'small'
    );
    
    if (quickWins.length > 0) {
      recommendations.push(
        `Start with ${quickWins.length} quick win${quickWins.length > 1 ? 's' : ''} ` +
        `that can be automatically fixed (formatting, lint errors)`
      );
    }
    
    // Check for documentation debt
    const docImprovements = improvements.filter(i => i.type === 'doc-add');
    if (docImprovements.length > 0) {
      recommendations.push(
        `Consider addressing ${docImprovements.length} documentation gaps ` +
        `to improve code maintainability`
      );
    }
    
    // Check for test gaps
    const testImprovements = improvements.filter(i => i.type === 'test-add');
    if (testImprovements.length > 0) {
      recommendations.push(
        `Add tests for ${testImprovements.length} files to improve reliability ` +
        `and prevent regressions`
      );
    }
    
    // General recommendation
    if (improvements.length === 0) {
      recommendations.push('Codebase appears to be in good shape! Consider running a full audit.');
    } else {
      recommendations.push(
        `Review the ${improvements.length} identified improvements and ` +
        `start with the highest priority items.`
      );
    }
    
    return recommendations;
  }

  /**
   * Sanitize a string for use in a branch name
   */
  private sanitizeBranchName(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]/g, '-')  // Replace non-alphanumeric with hyphens
      .replace(/--+/g, '-')           // Collapse multiple hyphens
      .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
  }

  /**
   * Check if a file is likely a test file based on path
   */
  private isLikelyTestFile(filepath: string): boolean {
    return (
      filepath.includes('/test/') || 
      filepath.includes('\\test\\') ||
      filepath.includes('/tests/') || 
      filepath.includes('\\tests\\') ||
      filepath.endsWith('.test.ts') || 
      filepath.endsWith('.spec.ts')
    );
  }

  /**
   * Check if a corresponding test file exists
   * This is a simplified check - in reality we'd look for *.test.ts or *.spec.ts
   */
  private hasTestFile(filepath: string): boolean {
    const dir = filepath.substring(0, filepath.lastIndexOf('/\\'));
    const base = filepath.substring(filepath.lastIndexOf('/\\') + 1);
    const nameWithoutExt = base.replace(/\.(ts|tsx)$/, '');
    
    const possibleTestPaths = [
      join(dir, `${nameWithoutExt}.test.ts`),
      join(dir, `${nameWithoutExt}.spec.ts`),
      join(dir, '__tests__', `${base}`),
      join(dir, '__tests__', `${nameWithoutExt}.test.ts`),
      join(dir, '__tests__', `${nameWithoutExt}.spec.ts`)
    ];
    
    // In a real implementation, we'd check if these files exist
    // For now, we'll return false to encourage test creation
    return false;
  }

  // Helper for path joining (since we can't import path in this context)
  private join(...parts: string[]): string {
    return parts.join('/').replace(/\/+/g, '/');
  }
}