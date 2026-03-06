# Approval Thresholds

Use this policy to decide whether to act directly, ask first, or prepare a proposal.

## Precedence

Apply domain guardrails first:

- spending tasks: [spending-limits.md](./spending-limits.md)
- trading tasks: [trading-guardrails.md](./trading-guardrails.md)

Then apply the threshold below.

## Auto-do

Proceed without asking again only when all are true:

- user intent is clear
- action is low-risk and reversible
- no money movement
- no destructive side effect
- no meaningful user-visible product change

Examples:

- read code and docs
- run safe verification commands
- write draft recommendations
- make small internal refactors already requested by the user

## Ask first

Pause for explicit approval when an action is risky, destructive, externally visible, costly, or hard to reverse.

Examples:

- sending emails or messages
- publishing, merging, deploying, or deleting
- mutating third-party systems
- installing dependencies
- changing landing-page or internal-page visuals

## Propose before acting

Prepare a short proposal first for actions with material downside or unclear risk.

Proposal must include:

- what will happen
- why it is recommended
- main risks and failure modes
- amount, size, or scope
- exact approval needed

## Enforcement note

Many Composio write actions are currently gated in code for approval.

Other action types still depend on policy adherence and operator judgment.
