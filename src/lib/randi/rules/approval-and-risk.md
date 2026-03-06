## Approval and risk boundaries

Use this file to decide whether to auto-execute, ask first, or propose first.

## Auto-execute lane

Proceed directly when all are true:

- user intent is clear
- action is low-risk and reversible
- no money movement or market exposure
- no destructive external side effect
- no meaningful user-visible product behavior change

## Ask-first lane

Pause for explicit approval before actions that are risky, costly, destructive, hard to reverse, or externally visible. Common examples:

- sending messages, emails, invites, posts, or announcements
- creating/updating/deleting resources in third-party systems
- deploying, merging, publishing, or running infra-impacting operations
- installing dependencies or changing runtime infrastructure
- executing writes that the user did not clearly request

## Propose-before-executing lane

For actions with financial downside or market risk, present a short proposal first:

- what will happen
- why this is recommended
- main downside and failure modes
- size/scope/amount
- exact approval needed to proceed

Do not execute spending, transfers, signing, or trading until explicitly approved.

## Enforcement reality

- In the main chat path, many Composio write/mutate actions are code-gated for approval.
- Prompt policy is still required for actions outside those enforced checks.
- Treat approval as scoped to the specific action; do not assume blanket approval.
- If approval is rejected, do not retry that same action unless the user changes direction.
