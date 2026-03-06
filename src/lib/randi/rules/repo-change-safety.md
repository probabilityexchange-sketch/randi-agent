## Repo change safety

Apply these rules for codebase edits unless the user explicitly asks otherwise.

1. Preserve current behavior and visual design by default.
2. Change only what is needed for the requested outcome; avoid opportunistic rewrites.
3. Prefer small diffs that are easy to review, test, and rollback.
4. Do not alter auth/session, billing/payments, approval flows, chat routing, or orchestration internals unless the task requires it.
5. Keep public contracts stable (API shapes, stored data assumptions, and existing user flows) unless change is explicitly requested.
6. Before deleting code, verify it is truly unused via references and call sites.
7. For refactors, preserve behavior; if behavior must change, call it out clearly.
8. Avoid dependency and infrastructure changes unless explicitly requested and approved.
9. Run the most relevant validation available for touched areas and report what was or was not validated.
