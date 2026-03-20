import { ResearchService, researchService } from '@/lib/research/service';
import type {
  BenchmarkCycleResult,
  ExperimentConfig,
  PersistEvolutionResult,
  ResearchExperimentRecord,
} from '@/lib/research/types';

export const RESEARCH_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'initiate_research_experiment',
      description:
        'Initiates an autonomous research experiment to improve prompts, tools, or strategies. The experiment will run benchmark cycles comparing base vs mutated configurations.',
      parameters: {
        type: 'object',
        properties: {
          objective: {
            type: 'string',
            description:
              'The research goal (e.g., "Reduce tool-call latency" or "Improve PR description clarity"). Be specific about what metric to optimize.',
          },
          baseConfigJson: {
            type: 'string',
            description:
              'JSON string of the base configuration to improve. Include systemPrompt, toolDescriptions, toolParameters as applicable.',
          },
          budgetMinutes: {
            type: 'number',
            default: 10,
            description: 'Wall-clock time budget for benchmark cycles (5-10 minutes recommended).',
          },
          maxIterations: {
            type: 'number',
            default: 3,
            description: 'Maximum mutation iterations to test.',
          },
        },
        required: ['objective', 'baseConfigJson'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_benchmark_cycle',
      description:
        'Executes a benchmark cycle for an experiment, comparing the mutated version against the base. Runs within bounded time budget.',
      parameters: {
        type: 'object',
        properties: {
          experimentId: {
            type: 'string',
            description: 'The ID of the research experiment to run.',
          },
        },
        required: ['experimentId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'persist_evolution',
      description:
        'Commits and pushes the improved configuration to a new research branch if the mutation showed positive improvement.',
      parameters: {
        type: 'object',
        properties: {
          experimentId: {
            type: 'string',
            description: 'The ID of the research experiment to persist.',
          },
        },
        required: ['experimentId'],
      },
    },
  },
] as const;

export async function executeResearchTool(
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  const service: ResearchService = researchService;

  if (toolName === 'initiate_research_experiment') {
    const { objective, baseConfigJson, budgetMinutes = 10, maxIterations = 3 } = args;

    try {
      let baseConfig: ExperimentConfig = {};
      try {
        baseConfig = JSON.parse(baseConfigJson);
      } catch {
        return JSON.stringify({ error: 'Invalid baseConfigJson: must be valid JSON' });
      }

      const result: ResearchExperimentRecord = await service.initiateExperiment({
        userId: args.userId || 'system',
        objective,
        baseConfig,
        budgetMinutes,
        maxIterations,
      });

      let summary = `## Research Experiment Initiated\n\n`;
      summary += `**Experiment ID:** ${result.id}\n`;
      summary += `**Objective:** ${result.objective}\n`;
      summary += `**Status:** ${result.status}\n`;
      summary += `**Budget:** ${result.budgetMinutes} minutes\n`;
      summary += `**Max Iterations:** ${result.maxIterations}\n`;
      summary += `\nUse \`run_benchmark_cycle\` with experimentId \`${result.id}\` to start benchmarking.`;

      return summary;
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to initiate research experiment',
      });
    }
  }

  if (toolName === 'run_benchmark_cycle') {
    const { experimentId } = args;

    try {
      const result: BenchmarkCycleResult = await service.runBenchmarkCycle(experimentId);

      if (!result.success) {
        return JSON.stringify({
          error: result.error || 'Benchmark cycle failed',
          experimentId,
        });
      }

      const { comparison } = result;
      let summary = `## Benchmark Cycle Complete\n\n`;
      summary += `**Experiment ID:** ${result.experimentId}\n`;
      summary += `**Winner:** ${comparison.winner.toUpperCase()}\n`;
      summary += `**Comparison Score:** ${comparison.comparisonScore.toFixed(4)}\n`;
      summary += `**Duration:** ${result.durationMs}ms\n`;
      summary += `**Iterations:** ${result.iterations}\n\n`;

      summary += `### Scores\n\n`;
      summary += `| Metric | Base | Mutated | Delta |\n`;
      summary += `|--------|------|---------|-------|\n`;

      if (
        comparison.baseScores.latencyMs !== undefined ||
        comparison.mutatedScores.latencyMs !== undefined
      ) {
        summary += `| Latency (ms) | ${comparison.baseScores.latencyMs?.toFixed(2) ?? 'N/A'} | ${comparison.mutatedScores.latencyMs?.toFixed(2) ?? 'N/A'} | ${comparison.delta.latencyMs?.toFixed(2) ?? 'N/A'} |\n`;
      }
      if (
        comparison.baseScores.successRate !== undefined ||
        comparison.mutatedScores.successRate !== undefined
      ) {
        summary += `| Success Rate | ${comparison.baseScores.successRate?.toFixed(4) ?? 'N/A'} | ${comparison.mutatedScores.successRate?.toFixed(4) ?? 'N/A'} | ${comparison.delta.successRate?.toFixed(4) ?? 'N/A'} |\n`;
      }
      if (
        comparison.baseScores.tokenUsage !== undefined ||
        comparison.mutatedScores.tokenUsage !== undefined
      ) {
        summary += `| Token Usage | ${comparison.baseScores.tokenUsage?.toFixed(0) ?? 'N/A'} | ${comparison.mutatedScores.tokenUsage?.toFixed(0) ?? 'N/A'} | ${comparison.delta.tokenUsage?.toFixed(0) ?? 'N/A'} |\n`;
      }
      if (
        comparison.baseScores.qualityScore !== undefined ||
        comparison.mutatedScores.qualityScore !== undefined
      ) {
        summary += `| Quality Score | ${comparison.baseScores.qualityScore?.toFixed(4) ?? 'N/A'} | ${comparison.mutatedScores.qualityScore?.toFixed(4) ?? 'N/A'} | ${comparison.delta.qualityScore?.toFixed(4) ?? 'N/A'} |\n`;
      }
      if (
        comparison.baseScores.errorRate !== undefined ||
        comparison.mutatedScores.errorRate !== undefined
      ) {
        summary += `| Error Rate | ${comparison.baseScores.errorRate?.toFixed(4) ?? 'N/A'} | ${comparison.mutatedScores.errorRate?.toFixed(4) ?? 'N/A'} | ${comparison.delta.errorRate?.toFixed(4) ?? 'N/A'} |\n`;
      }

      if (comparison.winner === 'mutated') {
        summary += `\nThe mutated configuration outperformed the base. Use \`persist_evolution\` to commit the improvements.`;
      } else if (comparison.winner === 'tie') {
        summary += `\nNo significant difference detected between configurations.`;
      } else {
        summary += `\nThe base configuration performed better. Consider refining the objective or mutation strategy.`;
      }

      return summary;
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Benchmark cycle failed',
        experimentId,
      });
    }
  }

  if (toolName === 'persist_evolution') {
    const { experimentId } = args;

    try {
      const result: PersistEvolutionResult = await service.persistEvolution(experimentId);

      if (!result.success) {
        return JSON.stringify({
          error: result.error || 'Failed to persist evolution',
          experimentId,
        });
      }

      let summary = `## Evolution Persisted\n\n`;
      summary += `**Experiment ID:** ${result.experimentId}\n`;
      summary += `**Status:** Success\n`;
      summary += `**Git Branch:** \`${result.gitBranch}\`\n`;
      summary += `**Commit SHA:** \`${result.commitSha}\`\n\n`;
      summary += `The improved configuration has been committed and pushed. Create a PR to merge the changes.`;

      return summary;
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to persist evolution',
        experimentId,
      });
    }
  }

  return JSON.stringify({ error: `Unknown research tool: ${toolName}` });
}

export function isResearchTool(toolName: string): boolean {
  return RESEARCH_TOOLS.some(t => t.type === 'function' && t.function.name === toolName);
}
