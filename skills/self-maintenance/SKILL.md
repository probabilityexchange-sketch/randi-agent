---
name: self-maintenance
description: A skill for the agent to inspect its own codebase, identify improvement opportunities, and execute bounded self-improvement tasks with git workflow integration.
---

# Self-Maintenance Skill

This skill enables the Randi agent to perform self-analysis and self-improvement tasks on its own codebase. It can:

1. Inspect the codebase for linting, formatting, and test coverage issues
2. Identify drift from established standards
3. Generate improvement proposals
4. Execute bounded self-improvement tasks with git branch workflow
5. Submit review-ready changes via pull requests

## When to Use

Use this skill when you want the agent to:

- Improve its own code quality
- Fix formatting and linting issues
- Increase test coverage
- Update documentation
- Perform maintenance tasks
- Prepare implementation plans for roadmap items

## How to Invoke

Trigger this skill by asking the agent to perform self-maintenance, for example:

- "Run self-maintenance on the codebase"
- "Analyze and fix linting errors in src/lib"
- "Generate a plan to improve test coverage for the credits module"
- "Check for documentation inconsistencies in the docs directory"

## Skill Capabilities

### Code Analysis

- Runs ESLint, Prettier, and Vitest coverage on specified paths
- Identifies violations of coding standards
- Detects missing or outdated documentation
- Finds test coverage gaps

### Improvement Generation

- Creates specific, actionable improvement tasks
- Formats changes according to project conventions
- Generates pull request descriptions with rationale
- Estimates effort and risk for each task
- Creates named branches for each improvement

### Git Workflow Execution

All improvements are executed with full git workflow:

1. **Branch Creation**: Each improvement creates a dedicated branch (e.g., `format/fix-src-lib-utils`)
2. **Staged Changes**: Modified files are staged for commit
3. **Commit**: Changes are committed with descriptive messages
4. **PR Generation**: Pull request is created with improvement details

### Execution Tiers

- **Auto-execute**: Formatting, lint fixes (safe, automated)
- **Ask-first**: Dependency updates, test additions (requires approval)
- **Propose-first**: Architectural changes, major refactors (requires proposal)

### Safe Execution

- Respects the approval system tiers above
- Includes rollback capability via git
- Branch-based workflow isolates changes

## Examples

### Example 1: Fix Linting Issues

```
Please run self-maintenance to fix all linting errors in the src/lib directory.
```

### Example 2: Improve Test Coverage

```
Analyze test coverage for the credits module and generate a plan to reach 80% coverage.
```

### Example 3: Documentation Audit

```
Check the docs directory for inconsistencies with the current implementation and suggest updates.
```

## Guidelines

1. Always respect the approval system - never execute risky changes without approval
2. Focus on bounded, reversible changes
3. Prioritize improvements that provide clear value (quality, maintainability, performance)
4. Keep the agent's own codebase in a deployable state at all times
5. When in doubt, ask for approval before proceeding
6. Use separate branches for each logical improvement group

## Related Skills

- This skill works well with the code-reviewer skill for validating changes
- Uses the same container orchestration as other agent skills
- Leverages the existing policy/approval system for safe execution
