# Composio Integrations

Composio is the primary integration layer for third-party SaaS actions.

## Current code touchpoints

- tool execution path: [src/app/api/chat/route.ts](../../src/app/api/chat/route.ts)
- write-action approval rules: [src/lib/composio/approval-rules.ts](../../src/lib/composio/approval-rules.ts)
- user preferences route: [src/app/api/user/agent-preferences/route.ts](../../src/app/api/user/agent-preferences/route.ts)

## Operating checklist

1. confirm connected account and auth state
2. classify action as read or write/mutate
3. apply [approval-thresholds.md](../policies/approval-thresholds.md) before execution
4. run the smallest viable action
5. report concrete results and any failure details

## Scope boundary

This file covers Composio-specific handling only.

For generic tool routing, use [tool-selection-rules.md](./tool-selection-rules.md).
