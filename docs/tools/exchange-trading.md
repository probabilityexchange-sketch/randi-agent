# Exchange Trading Guidance

This is a future-facing reference for any eventual exchange or execution integration.

## Current status

The current repo does not expose a complete code-enforced exchange trading toolchain.

Do not present exchange execution as an already available autonomous capability unless code changes explicitly add and validate it.

## Operator posture right now

- treat exchange actions as proposal-first workflows
- require explicit approval before any execution step
- use [../playbooks/prepare-trade-proposal.md](../playbooks/prepare-trade-proposal.md) for proposal structure
- apply [../policies/trading-guardrails.md](../policies/trading-guardrails.md) as constraints
