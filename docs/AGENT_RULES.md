# Agent Docs Architecture

This pack is operator-facing documentation for how to run and edit agent behavior safely.

It is not a runtime prompt bundle by itself.

## Runtime and enforcement boundaries

- Runtime prompt context is assembled from `src/lib/randi/` by [context.ts](../src/lib/randi/context.ts).
- User-specific prompt overrides are handled via `UserAgentPreference` and [`/api/user/agent-preferences`](../src/app/api/user/agent-preferences/route.ts).
- Code-enforced approval for many Composio write actions lives in [approval-rules.ts](../src/lib/composio/approval-rules.ts).

When code and docs differ, code behavior is the source of truth.

## Doc map

### Policies (what is allowed)

- [core-rules.md](./policies/core-rules.md): non-negotiable operating rules.
- [approval-thresholds.md](./policies/approval-thresholds.md): auto-do vs ask-first vs propose-first.
- [escalation-rules.md](./policies/escalation-rules.md): when to stop and request a decision.
- [spending-limits.md](./policies/spending-limits.md): spend-specific requirements.
- [trading-guardrails.md](./policies/trading-guardrails.md): trade-specific constraints.

### Playbooks (how to execute)

- [how-to-operate-as-randi.md](./playbooks/how-to-operate-as-randi.md): default operator workflow.
- [how-to-explain-actions.md](./playbooks/how-to-explain-actions.md): concise action narration format.
- [research-and-recommend.md](./playbooks/research-and-recommend.md): analysis and recommendation flow.
- [execute-approved-task.md](./playbooks/execute-approved-task.md): execute after explicit approval.
- [how-to-suggest-tools.md](./playbooks/how-to-suggest-tools.md): how to pitch tooling to users.
- [prepare-trade-proposal.md](./playbooks/prepare-trade-proposal.md): trade proposal template before execution.

### Tool docs (what tools exist and when to use them)

- [tool-catalog.md](./tools/tool-catalog.md): current tool categories and status.
- [tool-selection-rules.md](./tools/tool-selection-rules.md): decision rules for selecting tool paths.
- [composio-integrations.md](./tools/composio-integrations.md): Composio usage boundaries.
- [crypto-wallet.md](./tools/crypto-wallet.md): wallet-related operating rules.
- [exchange-trading.md](./tools/exchange-trading.md): exchange execution status and constraints.

## Editing rules

- Keep docs concise, concrete, and operational.
- Keep one canonical rule per topic; link instead of duplicating.
- Label non-enforced behavior as policy guidance, not guarantees.
- Do not claim capabilities that are not implemented in code.
