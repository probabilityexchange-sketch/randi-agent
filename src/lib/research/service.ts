import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import {
  BenchmarkCycleOptions,
  BenchmarkCycleResult,
  BenchmarkResult,
  BenchmarkScores,
  ComparisonResult,
  ExperimentConfig,
  InitiateExperimentOptions,
  MutationSuggestion,
  MutationTarget,
  MutationType,
  PersistEvolutionResult,
  ResearchExperimentRecord,
  ResearchStatus,
  SafetyGuardrails,
} from './types';

const PRISMA_CLIENT_PATH = '@/lib/db/prisma';

const SAFETY_GUARDRAILS: SafetyGuardrails = {
  maxWallClockMinutes: 10,
  maxTokenBudget: 500000,
  allowedMutationTypes: ['system_prompt_refine', 'tool_description_update', 'parameter_tweak'],
  blockedPaths: ['credentials', 'secrets', 'auth', '.env', 'password', 'token', 'key'],
  requireHumanApproval: false,
};

const MUTATION_ALLOWED_PATHS = ['systemPrompt', 'toolDescriptions', 'toolParameters'];

function isPathAllowed(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return !SAFETY_GUARDRAILS.blockedPaths.some(blocked => lowerPath.includes(blocked));
}

function validateMutationTarget(targetPath: string): boolean {
  if (!isPathAllowed(targetPath)) {
    return false;
  }
  const baseName = targetPath.split('/').pop() || targetPath;
  return MUTATION_ALLOWED_PATHS.some(allowed => baseName.includes(allowed));
}

class MutationEngine {
  private llmEndpoint: string;

  constructor(
    llmEndpoint: string = process.env.LLM_ENDPOINT || 'http://localhost:11434/api/generate'
  ) {
    this.llmEndpoint = llmEndpoint;
  }

  async suggestMutations(
    baseConfig: ExperimentConfig,
    objective: string
  ): Promise<MutationSuggestion[]> {
    const suggestions: MutationSuggestion[] = [];

    if (baseConfig.systemPrompt && isPathAllowed('systemPrompt')) {
      const promptMutation = await this.suggestPromptMutation(baseConfig.systemPrompt, objective);
      if (promptMutation) {
        suggestions.push(promptMutation);
      }
    }

    if (baseConfig.toolDescriptions && Object.keys(baseConfig.toolDescriptions).length > 0) {
      const toolMutations = await this.suggestToolDescriptionMutations(
        baseConfig.toolDescriptions,
        objective
      );
      suggestions.push(...toolMutations);
    }

    if (baseConfig.toolParameters && Object.keys(baseConfig.toolParameters).length > 0) {
      const paramMutations = await this.suggestParameterMutations(
        baseConfig.toolParameters,
        objective
      );
      suggestions.push(...paramMutations);
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private async suggestPromptMutation(
    systemPrompt: string,
    objective: string
  ): Promise<MutationSuggestion | null> {
    const prompt = `You are an expert at refining system prompts for AI agents.

Current System Prompt:
${systemPrompt}

Research Objective: ${objective}

Analyze the system prompt and suggest ONE targeted improvement. Consider:
- Clarity and specificity of instructions
- Edge case handling
- Output format constraints
- Task-specific optimizations

Respond with a JSON object containing:
{
  "suggestedValue": "improved system prompt text",
  "rationale": "brief explanation of why this improvement helps",
  "confidence": 0.0-1.0,
  "expectedImpact": "low|medium|high"
}

Only respond with valid JSON, no markdown formatting.`;

    try {
      const response = await fetch(this.llmEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt,
          stream: false,
          options: { temperature: 0.7, num_predict: 500 },
        }),
      });

      if (!response.ok) {
        return this.generateFallbackPromptMutation(systemPrompt, objective);
      }

      const data = await response.json();
      const parsed = this.parseLlmResponse(data.response || '');

      if (!parsed.suggestedValue) {
        return this.generateFallbackPromptMutation(systemPrompt, objective);
      }

      return {
        id: randomUUID(),
        target: {
          type: 'system_prompt_refine',
          targetPath: 'systemPrompt',
          description: 'System prompt refinement for better task alignment',
        },
        originalValue: systemPrompt,
        suggestedValue: parsed.suggestedValue,
        rationale: parsed.rationale || 'LLM-suggested prompt improvement',
        confidence: parsed.confidence || 0.5,
        expectedImpact: parsed.expectedImpact || 'medium',
      };
    } catch {
      return this.generateFallbackPromptMutation(systemPrompt, objective);
    }
  }

  private generateFallbackPromptMutation(
    systemPrompt: string,
    objective: string
  ): MutationSuggestion {
    const improvements: string[] = [];

    if (!systemPrompt.includes('objective') && !systemPrompt.includes('goal')) {
      improvements.push('- Explicitly state the primary objective at the start');
    }
    if (!systemPrompt.includes('step') && !systemPrompt.includes('phase')) {
      improvements.push('- Add clear step-by-step guidance');
    }
    if (!systemPrompt.includes('error') && !systemPrompt.includes('fail')) {
      improvements.push('- Include error handling guidance');
    }
    if (!systemPrompt.includes('output') && !systemPrompt.includes('format')) {
      improvements.push('- Specify expected output format');
    }

    const suggestedAddition = `\n\n## Research Objective\n${objective}\n\n## Guidelines\n- Work systematically through the objective\n- Validate intermediate results\n- Report progress and any blockers`;

    return {
      id: randomUUID(),
      target: {
        type: 'system_prompt_refine',
        targetPath: 'systemPrompt',
        description: 'System prompt refinement for research objective',
      },
      originalValue: systemPrompt,
      suggestedValue: systemPrompt + suggestedAddition,
      rationale:
        improvements.length > 0 ? improvements.join('; ') : 'Added structured guidance sections',
      confidence: 0.6,
      expectedImpact: 'medium',
    };
  }

  private async suggestToolDescriptionMutations(
    toolDescriptions: Record<string, string>,
    objective: string
  ): Promise<MutationSuggestion[]> {
    const suggestions: MutationSuggestion[] = [];

    for (const [toolName, description] of Object.entries(toolDescriptions)) {
      if (!isPathAllowed(toolName)) continue;

      const prompt = `Tool: ${toolName}
Current Description: ${description}
Research Goal: ${objective}

Suggest an improved description that better aligns this tool with the research goal.
Consider: clarity, expected inputs/outputs, and best practices.

Respond with JSON:
{
  "suggestedValue": "improved description",
  "rationale": "why this helps",
  "confidence": 0.0-1.0
}`;

      try {
        const response = await fetch(this.llmEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3.2',
            prompt,
            stream: false,
            options: { temperature: 0.5, num_predict: 200 },
          }),
        });

        let suggestedValue = description;
        let rationale = 'Minor description refinement';

        if (response.ok) {
          const data = await response.json();
          const parsed = this.parseLlmResponse(data.response || '');
          if (parsed.suggestedValue) {
            suggestedValue = parsed.suggestedValue;
            rationale = parsed.rationale || rationale;
          }
        }

        if (suggestedValue !== description) {
          suggestions.push({
            id: randomUUID(),
            target: {
              type: 'tool_description_update',
              targetPath: `toolDescriptions.${toolName}`,
              description: `Update description for ${toolName}`,
            },
            originalValue: description,
            suggestedValue,
            rationale,
            confidence: 0.5,
            expectedImpact: 'low',
          });
        }
      } catch {
        continue;
      }
    }

    return suggestions;
  }

  private async suggestParameterMutations(
    toolParameters: Record<string, any>,
    objective: string
  ): Promise<MutationSuggestion[]> {
    const suggestions: MutationSuggestion[] = [];
    const paramRanges: Record<string, { min: number; max: number; default: number }> = {
      temperature: { min: 0, max: 2, default: 0.7 },
      maxTokens: { min: 100, max: 32000, default: 4096 },
      topP: { min: 0, max: 1, default: 0.9 },
      topK: { min: 1, max: 100, default: 40 },
    };

    for (const [paramName, paramValue] of Object.entries(toolParameters)) {
      if (typeof paramValue !== 'number') continue;

      const range = paramRanges[paramName];
      if (!range) continue;

      let suggestedValue: number;
      let rationale: string;

      if (
        objective.toLowerCase().includes('quality') ||
        objective.toLowerCase().includes('accuracy')
      ) {
        suggestedValue =
          paramName === 'temperature' ? Math.max(range.min, paramValue - 0.2) : paramValue;
        rationale = `Lower ${paramName} for more deterministic, quality-focused output`;
      } else if (
        objective.toLowerCase().includes('creative') ||
        objective.toLowerCase().includes('diverse')
      ) {
        suggestedValue =
          paramName === 'temperature' ? Math.min(range.max, paramValue + 0.3) : paramValue;
        rationale = `Higher ${paramName} for more creative and diverse outputs`;
      } else {
        suggestedValue = paramValue;
        rationale = 'Parameter adjustment for balance';
      }

      if (suggestedValue !== paramValue) {
        suggestions.push({
          id: randomUUID(),
          target: {
            type: 'parameter_tweak',
            targetPath: `toolParameters.${paramName}`,
            description: `Adjust ${paramName} parameter`,
          },
          originalValue: String(paramValue),
          suggestedValue: String(suggestedValue),
          rationale,
          confidence: 0.4,
          expectedImpact: 'low',
        });
      }
    }

    return suggestions;
  }

  private parseLlmResponse(response: string): Record<string, any> {
    try {
      const cleaned = response.replace(/```json\n?|```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          return {};
        }
      }
      return {};
    }
  }
}

interface ComputeBridgeSession {
  id: string;
  endpoint: string;
  startedAt: Date;
}

interface RemoteBenchmarkTask {
  config: ExperimentConfig;
  taskPrompt: string;
  timeBudgetMs: number;
}

class BenchmarkRunner {
  private computeBridgeUrl: string;
  private mutationEngine: MutationEngine;

  constructor(
    computeBridgeUrl: string = process.env.COMPUTE_BRIDGE_URL || 'http://localhost:8080',
    mutationEngine?: MutationEngine
  ) {
    this.computeBridgeUrl = computeBridgeUrl;
    this.mutationEngine = mutationEngine || new MutationEngine();
  }

  async runComparison(
    baseConfig: ExperimentConfig,
    mutatedConfig: ExperimentConfig,
    options: BenchmarkCycleOptions
  ): Promise<ComparisonResult> {
    const maxIterations = Math.min(options.maxIterations || MAX_ITERATIONS, 3);
    const timeBudgetMs =
      (options.budgetMinutes || SAFETY_GUARDRAILS.maxWallClockMinutes) * 60 * 1000;
    const timePerIteration = Math.floor(timeBudgetMs / maxIterations);

    const baseResults: BenchmarkResult[] = [];
    const mutatedResults: BenchmarkResult[] = [];

    for (let i = 0; i < maxIterations; i++) {
      const taskPrompt = `Execute research iteration ${i + 1}/${maxIterations} with objective: ${options.experimentId}`;

      const baseResult = await this.runSingleBenchmark(baseConfig, taskPrompt, timePerIteration);
      baseResults.push(baseResult);

      const mutatedResult = await this.runSingleBenchmark(
        mutatedConfig,
        taskPrompt,
        timePerIteration
      );
      mutatedResults.push(mutatedResult);
    }

    return this.computeComparison(baseResults, mutatedResults);
  }

  private async runSingleBenchmark(
    config: ExperimentConfig,
    taskPrompt: string,
    timeBudgetMs: number
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const session = await this.spawnRemoteSession(config, timeBudgetMs);

    if (!session) {
      return {
        scores: { successRate: 0, errorRate: 1 },
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
        success: false,
        error: 'Failed to spawn remote session',
      };
    }

    try {
      const result = await this.waitForSessionCompletion(session.id, timeBudgetMs);
      const durationMs = Date.now() - startTime;

      return {
        scores: {
          latencyMs: result.latencyMs || durationMs,
          successRate: result.success ? 1 : 0,
          tokenUsage: result.tokenUsage || 0,
          qualityScore: result.qualityScore || 0,
          errorRate: result.success ? 0 : 1,
        },
        durationMs,
        timestamp: new Date(),
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        scores: { successRate: 0, errorRate: 1 },
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async spawnRemoteSession(
    config: ExperimentConfig,
    timeBudgetMs: number
  ): Promise<ComputeBridgeSession | null> {
    const task: RemoteBenchmarkTask = {
      config,
      taskPrompt: 'autonomous_research_session',
      timeBudgetMs,
    };

    try {
      const response = await fetch(`${this.computeBridgeUrl}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });

      if (!response.ok) {
        return this.createFallbackSession(config);
      }

      const data = await response.json();
      return {
        id: data.sessionId || randomUUID(),
        endpoint: data.endpoint || this.computeBridgeUrl,
        startedAt: new Date(),
      };
    } catch {
      return this.createFallbackSession(config);
    }
  }

  private createFallbackSession(config: ExperimentConfig): ComputeBridgeSession {
    return {
      id: `fallback-${randomUUID()}`,
      endpoint: this.computeBridgeUrl,
      startedAt: new Date(),
    };
  }

  private async waitForSessionCompletion(
    sessionId: string,
    timeoutMs: number
  ): Promise<{
    success: boolean;
    latencyMs?: number;
    tokenUsage?: number;
    qualityScore?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`${this.computeBridgeUrl}/sessions/${sessionId}/status`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'completed') {
            return {
              success: data.success !== false,
              latencyMs: data.latencyMs,
              tokenUsage: data.tokenUsage,
              qualityScore: data.qualityScore,
              error: data.error,
            };
          }
        }
      } catch {
        // Continue polling
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return { success: false, error: 'Session timeout' };
  }

  private computeComparison(
    baseResults: BenchmarkResult[],
    mutatedResults: BenchmarkResult[]
  ): ComparisonResult {
    const baseScores = this.aggregateScores(baseResults);
    const mutatedScores = this.aggregateScores(mutatedResults);

    const delta: BenchmarkScores = {
      latencyMs: (mutatedScores.latencyMs || 0) - (baseScores.latencyMs || 0),
      successRate: (mutatedScores.successRate || 0) - (baseScores.successRate || 0),
      tokenUsage: (mutatedScores.tokenUsage || 0) - (baseScores.tokenUsage || 0),
      qualityScore: (mutatedScores.qualityScore || 0) - (baseScores.qualityScore || 0),
      errorRate: (mutatedScores.errorRate || 0) - (baseScores.errorRate || 0),
    };

    const comparisonScore = this.calculateComparisonScore(delta);

    let winner: 'base' | 'mutated' | 'tie' = 'tie';
    if (comparisonScore > 0.05) {
      winner = 'mutated';
    } else if (comparisonScore < -0.05) {
      winner = 'base';
    }

    return {
      baseScores,
      mutatedScores,
      delta,
      comparisonScore,
      winner,
    };
  }

  private aggregateScores(results: BenchmarkResult[]): BenchmarkScores {
    if (results.length === 0) {
      return {};
    }

    const validResults = results.filter(r => r.success);
    const successRate = validResults.length / results.length;

    return {
      latencyMs: results.reduce((sum, r) => sum + (r.scores.latencyMs || 0), 0) / results.length,
      successRate,
      tokenUsage: results.reduce((sum, r) => sum + (r.scores.tokenUsage || 0), 0) / results.length,
      qualityScore:
        results.reduce((sum, r) => sum + (r.scores.qualityScore || 0), 0) / results.length,
      errorRate: 1 - successRate,
    };
  }

  private calculateComparisonScore(delta: BenchmarkScores): number {
    let score = 0;

    if (delta.successRate) {
      score += delta.successRate * 0.4;
    }
    if (delta.qualityScore) {
      score += delta.qualityScore * 0.3;
    }
    if (delta.latencyMs) {
      const latencyFactor = delta.latencyMs < 0 ? 0.1 : -0.05;
      score += latencyFactor * (Math.abs(delta.latencyMs) / 1000);
    }
    if (delta.errorRate) {
      score -= delta.errorRate * 0.2;
    }

    return score;
  }
}

class GitWorkflow {
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
  }

  async createBranch(branchName: string): Promise<boolean> {
    try {
      const sanitized = branchName.replace(/[^a-zA-Z0-9-_/]/g, '-').substring(0, 100);
      execSync('git fetch origin', { cwd: this.repoPath, stdio: 'pipe' });
      execSync(`git checkout -b ${sanitized}`, { cwd: this.repoPath, stdio: 'pipe' });
      return true;
    } catch {
      try {
        const sanitized = `feature/${randomUUID().substring(0, 8)}`;
        execSync(`git checkout -b ${sanitized}`, { cwd: this.repoPath, stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    }
  }

  async commitChanges(files: string[], message: string): Promise<string | null> {
    if (files.length === 0) return null;

    try {
      const escapedMessage = message.replace(/'/g, "'\\''").substring(0, 500);

      for (const file of files) {
        const escapedFile = file.replace(/'/g, "'\\''");
        execSync(`git add '${escapedFile}'`, { cwd: this.repoPath, stdio: 'pipe' });
      }

      const output = execSync(`git commit -m '${escapedMessage}'`, {
        cwd: this.repoPath,
        stdio: 'pipe',
      });
      const commitSha = output.toString().match(/\[.*\s+([a-f0-9]{8,})/)?.[1] || null;
      return commitSha;
    } catch {
      return null;
    }
  }

  async pushBranch(): Promise<boolean> {
    try {
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.repoPath,
        stdio: 'pipe',
      })
        .toString()
        .trim();
      execSync(`git push -u origin ${currentBranch}`, { cwd: this.repoPath, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}

interface PrismaClient {
  researchExperiment: {
    create: (data: any) => Promise<any>;
    findUnique: (query: any) => Promise<any>;
    update: (query: any) => Promise<any>;
  };
}

let prismaClient: PrismaClient | null = null;

async function getPrismaClient(): Promise<PrismaClient> {
  if (!prismaClient) {
    try {
      const { prisma } = await import(PRISMA_CLIENT_PATH);
      prismaClient = prisma as unknown as PrismaClient;
    } catch {
      prismaClient = createMockPrismaClient();
    }
  }
  return prismaClient;
}

function createMockPrismaClient(): PrismaClient {
  const experiments = new Map<string, ResearchExperimentRecord>();

  return {
    researchExperiment: {
      async create(data: any) {
        const record: ResearchExperimentRecord = {
          id: randomUUID(),
          userId: data.data.userId,
          objective: data.data.objective,
          status: 'PENDING' as ResearchStatus,
          baseConfig: data.data.baseConfig,
          mutatedConfig: {},
          baseScores: {},
          mutatedScores: {},
          budgetMinutes: data.data.budgetMinutes || 10,
          maxIterations: data.data.maxIterations || 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        experiments.set(record.id, record);
        return record;
      },
      async findUnique(query: any) {
        return experiments.get(query.where.id) || null;
      },
      async update(query: any) {
        const existing = experiments.get(query.where.id);
        if (!existing) return null;
        const updated = { ...existing, ...query.data, updatedAt: new Date() };
        experiments.set(updated.id, updated);
        return updated;
      },
    },
  };
}

class ResearchService {
  private mutationEngine: MutationEngine;
  private benchmarkRunner: BenchmarkRunner;
  private gitWorkflow: GitWorkflow;

  constructor() {
    this.mutationEngine = new MutationEngine();
    this.benchmarkRunner = new BenchmarkRunner();
    this.gitWorkflow = new GitWorkflow();
  }

  async initiateExperiment(options: InitiateExperimentOptions): Promise<ResearchExperimentRecord> {
    const budgetMinutes = Math.min(
      options.budgetMinutes || SAFETY_GUARDRAILS.maxWallClockMinutes,
      SAFETY_GUARDRAILS.maxWallClockMinutes
    );
    const maxIterations = Math.min(
      options.maxIterations || MAX_ITERATIONS,
      SAFETY_GUARDRAILS.maxIterations
    );

    const prisma = await getPrismaClient();

    const record = await prisma.researchExperiment.create({
      data: {
        userId: options.userId,
        objective: options.objective,
        baseConfig: options.baseConfig,
        mutatedConfig: {},
        baseScores: {},
        mutatedScores: {},
        budgetMinutes,
        maxIterations,
        status: 'PENDING',
      },
    });

    return record as ResearchExperimentRecord;
  }

  async runBenchmarkCycle(experimentId: string): Promise<BenchmarkCycleResult> {
    const startTime = Date.now();
    const prisma = await getPrismaClient();

    const experiment = await prisma.researchExperiment.findUnique({
      where: { id: experimentId },
    });

    if (!experiment) {
      return {
        experimentId,
        comparison: {
          baseScores: {},
          mutatedScores: {},
          delta: {},
          comparisonScore: 0,
          winner: 'tie',
        },
        iterations: 0,
        durationMs: Date.now() - startTime,
        success: false,
        error: 'Experiment not found',
      };
    }

    await prisma.researchExperiment.update({
      where: { id: experimentId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    try {
      let mutatedConfig = (experiment as any).mutatedConfig || {};

      if (Object.keys(mutatedConfig).length === 0) {
        const mutations = await this.mutationEngine.suggestMutations(
          (experiment as any).baseConfig || {},
          (experiment as any).objective || ''
        );

        mutatedConfig = this.applyMutations((experiment as any).baseConfig || {}, mutations);

        await prisma.researchExperiment.update({
          where: { id: experimentId },
          data: { mutatedConfig },
        });
      }

      const comparison = await this.benchmarkRunner.runComparison(
        (experiment as any).baseConfig || {},
        mutatedConfig,
        {
          experimentId,
          baseConfig: (experiment as any).baseConfig || {},
          mutatedConfig,
          budgetMinutes: (experiment as any).budgetMinutes || SAFETY_GUARDRAILS.maxWallClockMinutes,
          maxIterations: (experiment as any).maxIterations || MAX_ITERATIONS,
        }
      );

      await prisma.researchExperiment.update({
        where: { id: experimentId },
        data: {
          baseScores: comparison.baseScores,
          mutatedScores: comparison.mutatedScores,
          comparisonScore: comparison.comparisonScore,
          status: 'RUNNING',
        },
      });

      return {
        experimentId,
        comparison,
        iterations: MAX_ITERATIONS,
        durationMs: Date.now() - startTime,
        success: true,
      };
    } catch (error) {
      await prisma.researchExperiment.update({
        where: { id: experimentId },
        data: { status: 'FAILED' },
      });

      return {
        experimentId,
        comparison: {
          baseScores: {},
          mutatedScores: {},
          delta: {},
          comparisonScore: 0,
          winner: 'tie',
        },
        iterations: 0,
        durationMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async persistEvolution(experimentId: string): Promise<PersistEvolutionResult> {
    const prisma = await getPrismaClient();

    const experiment = await prisma.researchExperiment.findUnique({
      where: { id: experimentId },
    });

    if (!experiment) {
      return {
        experimentId,
        success: false,
        error: 'Experiment not found',
      };
    }

    const comparisonScore = (experiment as any).comparisonScore || 0;

    if (comparisonScore <= 0.05) {
      return {
        experimentId,
        success: false,
        error: 'Mutated version did not outperform base',
      };
    }

    const branchName = `research-evolution/${experimentId.substring(0, 8)}`;
    const branchCreated = await this.gitWorkflow.createBranch(branchName);

    if (!branchCreated) {
      return {
        experimentId,
        success: false,
        error: 'Failed to create branch',
      };
    }

    const configFiles = this.extractConfigFiles((experiment as any).mutatedConfig);
    const commitMessage = `Research evolution: ${(experiment as any).objective?.substring(0, 50) || 'Experiment evolution'}\n\nGenerated by autonomous research engine`;

    const commitSha = await this.gitWorkflow.commitChanges(configFiles, commitMessage);

    if (!commitSha) {
      return {
        experimentId,
        success: false,
        gitBranch: branchName,
        error: 'Failed to commit changes',
      };
    }

    await this.gitWorkflow.pushBranch();

    await prisma.researchExperiment.update({
      where: { id: experimentId },
      data: {
        status: 'EVOLVED',
        gitBranch: branchName,
        commitSha,
        completedAt: new Date(),
      },
    });

    return {
      experimentId,
      success: true,
      gitBranch: branchName,
      commitSha,
    };
  }

  async getExperiment(experimentId: string): Promise<ResearchExperimentRecord | null> {
    const prisma = await getPrismaClient();
    const experiment = await prisma.researchExperiment.findUnique({
      where: { id: experimentId },
    });
    return experiment as ResearchExperimentRecord | null;
  }

  private applyMutations(
    baseConfig: ExperimentConfig,
    mutations: MutationSuggestion[]
  ): ExperimentConfig {
    const mutatedConfig: ExperimentConfig = { ...baseConfig };

    for (const mutation of mutations) {
      if (!validateMutationTarget(mutation.target.targetPath)) {
        continue;
      }

      const targetPath = mutation.target.targetPath;

      if (targetPath === 'systemPrompt') {
        mutatedConfig.systemPrompt = mutation.suggestedValue;
      } else if (targetPath.startsWith('toolDescriptions.')) {
        const toolName = targetPath.replace('toolDescriptions.', '');
        mutatedConfig.toolDescriptions = {
          ...mutatedConfig.toolDescriptions,
          [toolName]: mutation.suggestedValue,
        };
      } else if (targetPath.startsWith('toolParameters.')) {
        const paramName = targetPath.replace('toolParameters.', '');
        mutatedConfig.toolParameters = {
          ...mutatedConfig.toolParameters,
          [paramName]: this.parseValue(mutation.suggestedValue),
        };
      }
    }

    return mutatedConfig;
  }

  private parseValue(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      const num = Number(value);
      if (!isNaN(num)) return num;
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
      return value;
    }
  }

  private extractConfigFiles(config: ExperimentConfig): string[] {
    const files: string[] = [];

    if (config.systemPrompt) {
      files.push('config/system-prompt.md');
      files.push('src/config/prompt.ts');
    }

    if (config.toolDescriptions) {
      files.push('src/config/tools.ts');
      files.push('config/tool-descriptions.json');
    }

    if (config.toolParameters) {
      files.push('config/parameters.json');
      files.push('src/config/parameters.ts');
    }

    return [...new Set(files)];
  }
}

export const researchService = new ResearchService();
export { MutationEngine, BenchmarkRunner, GitWorkflow, ResearchService };
