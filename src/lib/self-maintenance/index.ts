import { CodeAnalyzer } from './analyzer';
import { ImprovementGenerator } from './improvement-generator';
import { ImprovementExecutor } from './executor';

export { CodeAnalyzer, ImprovementGenerator, ImprovementExecutor };

// Export a convenient facade for use in skills
export class SelfMaintenanceService {
  private analyzer: CodeAnalyzer;
  private generator: ImprovementGenerator;
  private executor: ImprovementExecutor;

  constructor(rootDir: string = process.cwd()) {
    this.analyzer = new CodeAnalyzer(rootDir);
    this.generator = new ImprovementGenerator();
    this.executor = new ImprovementExecutor(rootDir);
  }

  /**
   * Analyze code and return results
   */
  async analyze(targetPath: string = 'src') {
    return await this.analyzer.analyze(targetPath);
  }

  /**
   * Generate an improvement plan from analysis results
   */
  generatePlan(results: ReturnType<this['analyze']>) {
    return this.generator.generateImprovements(results);
  }

  /**
   * Execute a specific improvement
   */
  async execute(improvement: Parameters<this['executor']['execute']>[0]) {
    return await this.executor.execute(improvement);
  }

  /**
   * Run a full self-maintenance cycle: analyze, generate plan, optionally execute
   */
  async runCycle(options: {
    targetPath?: string;
    autoFix?: boolean; // Whether to automatically execute safe improvements
    interactive?: boolean; // Whether to require confirmation for each improvement
  } = {}): Promise<{
    analysis: ReturnType<this['analyze']>;
    plan: ReturnType<this['generatePlan']>;
    executionResults?: ExecutionResult[];
  }> {
    const { targetPath = 'src', autoFix = false, interactive = false } = options;
    
    // Step 1: Analyze
    const analysis = await this.analyze(targetPath);
    
    // Step 2: Generate plan
    const plan = this.generatePlan(analysis);
    
    // Step 3: Optionally execute
    let executionResults: ExecutionResult[] | undefined;
    
    if (autoFix && plan.improvements.length > 0) {
      // Filter to only safe, automatable improvements if not interactive
      const improvementsToExecute = interactive 
        ? plan.improvements 
        : plan.improvements.filter(imp => 
            imp.automatable && 
            (imp.type === 'format-fix' || imp.type === 'lint-fix') && 
            imp.priority === 'high'
          );
      
      executionResults = [];
      for (const improvement of improvementsToExecute) {
        const result = await this.execute(improvement);
        executionResults.push(result);
        
        // If interactive and execution failed or requires input, stop
        if (interactive && (!result.success || result.error)) {
          break;
        }
      }
    }
    
    return {
      analysis,
      plan,
      executionResults
    };
  }
}