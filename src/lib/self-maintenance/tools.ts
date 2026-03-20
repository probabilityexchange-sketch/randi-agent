import { SelfMaintenanceService } from '@/lib/self-maintenance';

export const SELF_MAINTENANCE_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'run_self_maintenance',
      description:
        'Run self-maintenance analysis and optionally fix issues in the codebase. Analyzes code quality, generates improvement plans, and can execute fixes with git workflow (branch, commit, PR).',
      parameters: {
        type: 'object',
        properties: {
          targetPath: {
            type: 'string',
            default: 'src',
            description:
              "The path to analyze and fix (e.g., 'src/lib', 'src/app'). Defaults to 'src'.",
          },
          autoFix: {
            type: 'boolean',
            default: false,
            description:
              'Whether to automatically execute safe improvements (format fixes, lint fixes). When false, only analysis is performed.',
          },
          interactive: {
            type: 'boolean',
            default: false,
            description:
              'Whether to require confirmation for each improvement. If false, only high-priority automatable improvements are executed.',
          },
          useGitWorkflow: {
            type: 'boolean',
            default: true,
            description:
              'Whether to create git branches and commits for changes. When true, each improvement creates a branch, commits changes, and creates a PR.',
          },
          containerIsolation: {
            type: 'boolean',
            default: false,
            description:
              'Whether to execute changes in isolated Docker containers for safety. More secure but slower.',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'analyze_code_quality',
      description:
        'Analyze code quality issues (linting, formatting, test coverage, documentation) in a specific path without making any changes.',
      parameters: {
        type: 'object',
        properties: {
          targetPath: {
            type: 'string',
            default: 'src',
            description: "The path to analyze (e.g., 'src/lib', 'src/app'). Defaults to 'src'.",
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_improvement_plan',
      description:
        'Generate a detailed improvement plan based on code analysis. Returns prioritized improvements with effort estimates and automatable flags.',
      parameters: {
        type: 'object',
        properties: {
          targetPath: {
            type: 'string',
            default: 'src',
            description: "The path to analyze (e.g., 'src/lib', 'src/app'). Defaults to 'src'.",
          },
        },
      },
    },
  },
] as const;

export async function executeSelfMaintenanceTool(
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  const service = new SelfMaintenanceService(process.cwd());

  if (toolName === 'run_self_maintenance') {
    const {
      targetPath = 'src',
      autoFix = false,
      interactive = false,
      useGitWorkflow = true,
      containerIsolation = false,
    } = args;

    try {
      const result = await service.runCycle({
        targetPath,
        autoFix,
        interactive,
      });

      const executionResults = result.executionResults || [];
      const successful = executionResults.filter(r => r.success);
      const failed = executionResults.filter(r => !r.success);

      let summary = `## Self-Maintenance Complete\n\n`;
      summary += `**Analysis:** Found ${result.plan.improvements.length} improvements (${result.plan.summary.highPriority} high priority)\n`;
      summary += `**Auto-fixed:** ${successful.length} issue(s)\n`;

      if (failed.length > 0) {
        summary += `**Failed:** ${failed.length} issue(s)\n`;
        summary += `Errors:\n${failed.map(f => `- ${f.error}`).join('\n')}\n`;
      }

      if (executionResults.length > 0) {
        summary += `\n### Execution Results\n`;
        for (const res of executionResults) {
          summary += `- ${res.success ? 'Success' : 'Failed'}: ${res.output.substring(0, 100)}${res.output.length > 100 ? '...' : ''}\n`;
        }
      }

      summary += `\n### Summary\n`;
      summary += `Total effort: ${result.plan.summary.estimatedTotalEffort}\n`;
      summary += `\n### Recommendations\n`;
      summary += result.plan.recommendations.map(r => `- ${r}`).join('\n');

      return summary;
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Self-maintenance failed',
      });
    }
  }

  if (toolName === 'analyze_code_quality') {
    const { targetPath = 'src' } = args;

    try {
      const analysis = await service.analyze(targetPath);

      let summary = `## Code Quality Analysis: ${targetPath}\n\n`;
      summary += `Analyzed ${analysis.length} file(s)\n\n`;

      const issuesByType: Record<string, number> = {};
      for (const result of analysis) {
        for (const issue of result.issues) {
          issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
        }
      }

      summary += `### Issues Found\n`;
      for (const [type, count] of Object.entries(issuesByType)) {
        summary += `- ${type}: ${count}\n`;
      }

      return summary;
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Analysis failed',
      });
    }
  }

  if (toolName === 'generate_improvement_plan') {
    const { targetPath = 'src' } = args;

    try {
      const analysis = await service.analyze(targetPath);
      const plan = service.generatePlan(analysis);

      let summary = `## Improvement Plan: ${targetPath}\n\n`;
      summary += `**Total Improvements:** ${plan.summary.total}\n`;
      summary += `**High Priority:** ${plan.summary.highPriority}\n`;
      summary += `**Automatable:** ${plan.summary.automatable}\n`;
      summary += `**Estimated Effort:** ${plan.summary.estimatedTotalEffort}\n\n`;

      summary += `### Improvements\n`;
      for (const imp of plan.improvements.slice(0, 10)) {
        summary += `\n#### ${imp.type}: ${imp.filepath}\n`;
        summary += `- **Priority:** ${imp.priority}\n`;
        summary += `- **Effort:** ${imp.estimatedEffort}\n`;
        summary += `- **Automatable:** ${imp.automatable ? 'Yes' : 'No'}\n`;
        summary += `- **Branch:** \`${imp.branchName}\`\n`;
        summary += `- **Commit:** ${imp.commitMessage}\n`;
      }

      if (plan.improvements.length > 10) {
        summary += `\n_... and ${plan.improvements.length - 10} more improvements_\n`;
      }

      summary += `\n### Recommendations\n`;
      summary += plan.recommendations.map(r => `- ${r}`).join('\n');

      return summary;
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Plan generation failed',
      });
    }
  }

  return JSON.stringify({ error: `Unknown self-maintenance tool: ${toolName}` });
}

export function isSelfMaintenanceTool(toolName: string): boolean {
  return SELF_MAINTENANCE_TOOLS.some(t => t.type === 'function' && t.function.name === toolName);
}
