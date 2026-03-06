# Tool Selection Rules

Use this file to decide the execution path. Keep this decision separate from how you explain the suggestion.

## Choose direct reasoning when

- the answer is already available from local context
- the user is asking for explanation or recommendation only
- using a tool would add latency without adding confidence

## Choose local repo operations when

- the task is about code/docs in this repository
- shell commands or edits are sufficient
- external state is not required

## Choose an integration tool when

- fresh external state is needed
- the task depends on a third-party system
- the user asked for a real action in an external service

## Choose delegation when

- a bounded subtask fits a specialist role
- the user benefits from a narrower expert perspective

## Choose autonomous developer spawning when

- the task is a larger repo-level coding project
- the work has a clear deliverable
- a longer-running coding loop is justified

Use the smallest capable tool path first.

For user-facing wording of a tool recommendation, use [../playbooks/how-to-suggest-tools.md](../playbooks/how-to-suggest-tools.md).
