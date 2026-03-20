/**
 * Research Experiment Status
 */
export type ResearchStatus = 'PENDING' | 'RUNNING' | 'EVOLVED' | 'FAILED';

/**
 * Mutation types that the mutation engine can suggest
 */
export type MutationType =
  | 'system_prompt_refine' // Improve existing prompts
  | 'tool_description_update' // Update tool descriptions
  | 'parameter_tweak' // Adjust tool parameters
  | 'workflow_reorder' // Reorder execution steps
  | 'context_expand'; // Expand context window usage

/**
 * Target areas for mutation
 */
export interface MutationTarget {
  type: MutationType;
  targetPath: string; // e.g., "src/lib/orchestration/tools.ts" or "systemPrompt"
  description: string;
}

/**
 * A single mutation suggestion
 */
export interface MutationSuggestion {
  id: string;
  target: MutationTarget;
  originalValue: string;
  suggestedValue: string;
  rationale: string;
  confidence: number; // 0-1 confidence score
  expectedImpact: 'low' | 'medium' | 'high';
}

/**
 * Benchmark metrics for evaluating experiment outcomes
 */
export interface BenchmarkScores {
  latencyMs?: number; // Tool-call latency
  successRate?: number; // Success rate (0-1)
  tokenUsage?: number; // Token consumption
  qualityScore?: number; // Quality metric (0-1)
  errorRate?: number; // Error frequency (0-1)
  customMetrics?: Record<string, number>;
}

/**
 * Result of a single benchmark run
 */
export interface BenchmarkResult {
  scores: BenchmarkScores;
  durationMs: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

/**
 * Comparison between base and mutated versions
 */
export interface ComparisonResult {
  baseScores: BenchmarkScores;
  mutatedScores: BenchmarkScores;
  delta: BenchmarkScores; // mutatedScores - baseScores
  comparisonScore: number; // Aggregate improvement score (positive = mutated better)
  winner: 'base' | 'mutated' | 'tie';
}

/**
 * Configuration being experimented on
 */
export interface ExperimentConfig {
  systemPrompt?: string;
  toolDescriptions?: Record<string, string>;
  toolParameters?: Record<string, any>;
  customSettings?: Record<string, any>;
}

/**
 * Full research experiment record
 */
export interface ResearchExperimentRecord {
  id: string;
  userId: string;
  objective: string;
  status: ResearchStatus;
  baseConfig: ExperimentConfig;
  mutatedConfig: ExperimentConfig;
  baseScores: BenchmarkScores;
  mutatedScores: BenchmarkScores;
  comparisonScore?: number;
  gitBranch?: string;
  commitSha?: string;
  budgetMinutes: number;
  maxIterations: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Options for running a benchmark cycle
 */
export interface BenchmarkCycleOptions {
  experimentId: string;
  baseConfig: ExperimentConfig;
  mutatedConfig: ExperimentConfig;
  budgetMinutes?: number; // Wall-clock time limit (default: 10)
  maxIterations?: number; // Max test iterations (default: 3)
}

/**
 * Result of a benchmark cycle execution
 */
export interface BenchmarkCycleResult {
  experimentId: string;
  comparison: ComparisonResult;
  iterations: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

/**
 * Options for initiating a research experiment
 */
export interface InitiateExperimentOptions {
  userId: string;
  objective: string;
  baseConfig: ExperimentConfig;
  budgetMinutes?: number; // Default: 10
  maxIterations?: number; // Default: 3
}

/**
 * Result of persisting an evolution
 */
export interface PersistEvolutionResult {
  experimentId: string;
  success: boolean;
  gitBranch?: string;
  commitSha?: string;
  error?: string;
}

/**
 * Safety guardrails for research cycles
 */
export interface SafetyGuardrails {
  maxWallClockMinutes: number; // Hard limit on wall-clock time
  maxTokenBudget: number; // Max tokens to spend
  allowedMutationTypes: MutationType[];
  blockedPaths: string[]; // File paths that cannot be mutated
  requireHumanApproval: boolean; // Require approval before persistence
}
