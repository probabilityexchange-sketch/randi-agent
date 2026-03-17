# Agent OS Standards & Guidelines

This directory contains architectural standards and guidelines for building a self-maintaining agent system.

## Structure

- **database/** - Database patterns and strategies for agent systems
  - soft-delete-pattern.md
  - indexing-strategy.md
  - relation-pattern.md
  - timestamp-fields.md
  - id-field-pattern.md

- **api/** - API design standards
  - auth-middleware.md
  - error-responses.md

## Self-Maintenance System

The self-maintenance system is now integrated into the core platform and follows these principles:

### Core Principles

1. **Autonomous Yet Safe**: Agents can improve their own codebase, but all changes require appropriate approval levels
2. **Incremental Changes**: Small, focused changes over time rather than massive rewrites
3. **Verification First**: Always verify changes don't break the system before committing
4. **Transparency**: Every change must be clearly documented and attributable
5. **Reversibility**: All changes must be easily reversible via git

### Improvement Categories

#### 1. Formatting Fixes (Auto-Execute)
- Prettier formatting
- ESLint --fix (quotes, semicolons, spacing)
- Whitespace-only changes
- *Requires no approval*

#### 2. Linting Fixes (Auto-Execute)
- ESLint auto-fixable rule violations
- Code style corrections
- *Requires no approval*

#### 3. Documentation (Ask-First)
- Missing JSDoc comments
- Outdated comments
- Broken cross-references
- *Requires human approval for content*

#### 4. Testing (Ask-First)
- Adding new test files
- Test coverage improvements
- Test maintenance
- *Requires human approval for test strategy*

#### 5. Refactoring (Propose-First)
- Structural changes
- Breaking changes
- API modifications
- *Requires detailed proposal and approval*

### Execution Flow

```
Analysis → Classification → Prioritization → Execution → Verification → Reporting
    ↓            ↓              ↓              ↓           ↓           ↓
  Run tools   Categorize    Estimate risk   Branch-based  Build tests  Summary
  errors     by type       by priority    isolation    execution   with PRs
```

### Safety Mechanisms

1. **Feature Branches**: All changes in isolated branches
2. **Build Verification**: Build succeeds before commit
3. **Test Execution**: Tests pass after changes
4. **Rollback Capability**: Easy git reset
5. **Incremental Deployment**: Changes deployed as small, reviewable units

### Integration Points

- Uses existing approval system (`src/lib/composio/approval-rules.ts`)
- Leverages Docker bridge for isolated execution
- Integrates with existing skills system
- Follows project conventions from `docs/CODE_STANDARDS.md`

## Best Practices

### For Self-Maintenance Tasks

1. **Be Conservative**: Start with low-risk, high-value improvements
2. **Iterate**: Focus on small wins first, then tackle larger changes
3. **Communicate**: Clearly explain what you're doing and why
4. **Verify**: Always verify builds and tests pass
5. **Document**: Every change needs a clear commit message and PR description

### For Users

1. **Start Small**: Begin with formatting/linting fixes before major changes
2. **Review First**: Always review improvement plans before approving
3. **Give Feedback**: Tell the agent what you like or don't like
4. **Set Boundaries**: Tell the agent which areas are off-limits
5. **Iterate**: Self-maintenance is a continuous process, not a one-time fix

## Metrics to Track

1. **Code Quality**: Linting errors, formatting issues, coverage gaps
2. **Time Saved**: Hours spent on maintenance vs. automation
3. **Approval Rate**: How often improvements are auto-approved vs. need human input
4. **Build Reliability**: Build success rate after self-maintenance changes
5. **Test Coverage**: Coverage trends over time

## Future Roadmap

### Short Term
- [ ] AST-based documentation generation
- [ ] Better test generation capabilities
- [ ] Dependency update suggestions
- [ ] Smart scheduling (daily/weekly maintenance)

### Medium Term
- [ ] PR creation workflow
- [ ] Automated review assistance
- [ ] Pattern-based refactoring suggestions
- [ ] Performance optimization suggestions

### Long Term
- [ ] Complete autonomous feature implementation
- [ ] Swarm self-maintenance (multiple agents working together)
- [ ] Cognitive load management
- [ ] Evolution tracking and drift detection

## Integration with Randi Platform

This self-maintenance system is a foundational component of:

1. **Phase 7: The Sovereign Agent** - Making Randi capable of maintaining itself
2. **Autonomous Feature Execution** - Turning roadmap items into implementable tasks
3. **Platform Stability** - Ensuring the codebase stays maintainable at scale

The self-maintenance capabilities enable all other advanced features by:
- Keeping the codebase clean and maintainable
- Enforcing consistency and standards
- Identifying improvement opportunities
- Preparing the ground for autonomous development

## Related Resources

- ROADMAP.md - Overall strategic vision
- docs/CODE_STANDARDS.md - Code quality guidelines
- docs/TESTING_GUIDE.md - Testing standards and practices
- docs/CONTRIBUTING.md - How to contribute improvements
- src/lib/randi/skills/self-maintenance.md - Agent operating playbook