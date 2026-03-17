# Self-Maintenance Operating Playbook

This playbook defines how the agent should perform self-maintenance tasks on its own codebase.

## Purpose
Enable the agent to analyze, improve, and maintain its own code quality through automated analysis and bounded self-improvement tasks.

## When to Activate
Activate this playbook when:
- The user requests self-maintenance or code quality improvements
- Scheduled maintenance intervals (daily/weekly)
- Before major feature development to ensure clean starting point
- After detecting code quality degradation through monitoring

## Activation Phrases
Users can trigger this by saying:
- "Run self-maintenance on the codebase"
- "Analyze and fix code quality issues"
- "Improve test coverage for [module]"
- "Check for documentation consistency"
- "Perform codebase health check"

## Execution Boundaries

### Auto-Execute Lane (No Approval Needed)
Proceed directly when all are true:
- Action is limited to formatting fixes (Prettier)
- Action is limited to auto-fixable linting errors (ESlint --fix)
- No changes to dependencies or configuration files
- Changes are limited to whitespace, semicolons, quotes, etc.
- The change can be fully automated and is reversible

### Ask-First Lane (Approval Required)
Pause for explicit approval when:
- Adding documentation (JSDoc comments)
- Adding or updating test files
- Updating dependencies
- Making changes that affect the public API
- Any change that requires semantic understanding

### Propose-First Lane (Approval + Planning Required)
Prepare a short proposal first for:
- Architectural changes
- Major refactors
- Changes to configuration or build scripts
- Any change that could affect runtime behavior
- Changes to security-related code

## Constraints
1. **Scope Limitation**: Only work on the Randi Agent Platform codebase (this repository)
2. **Reversibility**: All changes must be easily reversible via git
3. **Safety**: Never execute changes that could break the build or core functionality without approval
4. **Transparency**: All changes must be clearly documented in commit messages
5. **Bounded Execution**: Limit self-maintenance sessions to reasonable time/change limits

## Process Flow

### 1. Analysis Phase
- Run ESLint to identify linting issues
- Run Prettier to check formatting
- Analyze test coverage (if configured)
- Check for missing documentation (JSDoc)
- File-specific analysis based on user request

### 2. Improvement Generation
- Categorize issues by type and severity
- Generate specific, actionable improvement tasks
- Estimate effort and prioritize by impact
- Determine approval requirements for each task

### 3. Execution Phase
- For auto-executable items: format, lint fixes
- For ask-first items: request approval before proceeding
- For propose-first items: create detailed plan and wait for approval
- Execute in order of priority and safety

### 4. Reporting Phase
- Summarize changes made
- Report any issues that require attention
- Suggest next steps for ongoing maintenance
- Provide metrics before/after if applicable

## Approval Guidelines

### Auto-Approve These:
- `npm run format` changes
- `npm run lint --fix` for specific rule fixes (e.g., quotes, semicolons)
- Whitespace-only changes
- File renaming that doesn't change meaning

### Require Approval For:
- Adding new dependencies
- Changing existing dependencies
- Modifying tsconfig.json, jest.config.ts, or similar config files
- Changes to authentication or security-related code
- Public API modifications
- Architectural changes

### Always Require Proposal:
- Changes to Docker configuration
- Changes to CI/CD pipelines
- Major framework upgrades (Next.js, React, etc.)
- Changes that affect container provisioning
- Database schema changes

## Safety Measures
1. **Git-Based Workflow**: All changes happen in a feature branch
2. **Build Verification**: Verify build succeeds after changes
3. **Test Verification**: Run tests to ensure nothing broken
4. **Rollback Capability**: Easy to revert via git reset
5. **Incremental Changes**: Small, focused changes rather than bulk modifications

## Success Criteria
- Codebase passes `npm run lint` and `npm run format:check`
- No increase in linting errors or formatting issues
- Test coverage maintained or improved
- Documentation quality maintained or improved
- All changes are clearly documented and attributable

## Reporting Format
When completing self-maintenance, report:
- Summary of analysis (issues found)
- Actions taken (with commit references)
- Metrics before/after (if applicable)
- Any items requiring follow-up
- Suggested maintenance schedule

## Example Execution
User: "Run self-maintenance on the src/lib/credits module"

Agent Response:
```
I'll run self-maintenance on the credits module to check for code quality improvements.

Analysis Phase:
- Found 3 formatting issues (Prettier)
- Found 2 linting errors (ESlint)
- Test coverage: 65% (target: 80%)
- Documentation: 2 missing JSDoc comments

Improvement Plan:
1. [AUTO] Fix formatting in credits/engine.ts
2. [AUTO] Fix linting errors in credits/estimator.ts
3. [ASK] Add missing JSDoc in credits/engine.ts (2 locations)
4. [ASK] Create plan to improve test coverage to 80%

Would you like me to proceed with the auto-fixable items first?
```