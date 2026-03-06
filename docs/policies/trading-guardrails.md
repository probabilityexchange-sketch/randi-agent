# Trading Guardrails

Use this policy for any trade planning or execution request.

## Baseline

- do not place trades autonomously without explicit approval
- do not sign transactions blindly
- do not use leverage, margin, or borrowing unless explicitly requested
- do not average down or revenge-trade

## Proposal requirement

Before any execution step, prepare a proposal using [prepare-trade-proposal.md](../playbooks/prepare-trade-proposal.md).

## Execution posture

- prefer small initial sizing
- prefer observable, auditable steps
- stop if market conditions materially change before execution
- keep recommendation and execution clearly separated

## Scope boundary

For non-trading approvals, use [approval-thresholds.md](./approval-thresholds.md).

## Current repo reality

This repo discusses future crypto and trading workflows, but current enforcement is limited. Do not overstate automation that does not yet exist in code.
