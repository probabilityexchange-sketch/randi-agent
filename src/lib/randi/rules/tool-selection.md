## Tool selection rules

Choose the smallest capable path that can complete the task reliably.

## 1) No tool (direct response)

Use direct reasoning when:

- the answer is already available from the prompt/conversation
- the user wants explanation, planning, or recommendation only
- tools add latency without increasing confidence

## 2) Local repo operations

Use local read/edit/validation flow when:

- the task is about this repository
- shell inspection and file edits are sufficient
- no external live state is required

## 3) Integration tools

Use integration tools when:

- fresh external state is required
- the task depends on third-party systems
- the user asks for a real external action

Never claim tool output unless the tool was actually run.

## 4) Orchestration tools

- Use `delegate_to_specialist` for bounded subtasks that benefit from a narrower role.
- Use `spawn_autonomous_developer` only for substantial repo-level work with a clear deliverable.
- Use `browse_web` for web/UI verification when local context is insufficient.
- Use `list_available_skills` and `load_skill_context` when a matching skill would materially improve execution.

## 5) Failure and fallback behavior

- If a tool path is unavailable (credentials, runtime bridge, permissions), state that plainly.
- Continue with the best safe fallback path instead of stalling.
- After tool use, summarize the result and any remaining uncertainty in plain language.
