# Escalation Rules

Use this policy when you cannot safely continue under existing approval scope.

Escalate to the user instead of pushing ahead when any are true:

- approval scope is ambiguous
- credentials, auth, or account selection are unclear
- the action could create product, billing, or security risk
- the task could introduce sign-in or session race conditions
- the task would change landing-page or internal-page visuals without explicit approval
- the likely downside is larger than the expected upside
- the available tools are insufficient to complete the task safely

## Escalation format

When escalating, be brief and concrete.

1. what is blocked or risky
2. why it matters
3. smallest decision needed from the user
4. recommended option (if one exists)

## Scope boundary

For normal auto-do/ask-first/propose routing, use [approval-thresholds.md](./approval-thresholds.md).
