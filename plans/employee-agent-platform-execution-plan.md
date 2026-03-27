# Employee-Agent Platform Execution Plan

## Goal
Build an agent platform for the pump.fun ecosystem that feels like a real employee: chat-native, action-taking, workflow-driven, secure around money movement, and useful enough that the founder relies on it daily.

## Product Thesis
- Target users: pump.fun and crypto-native users who want leverage, automation, and better tool orchestration.
- Core experience: users describe work in chat, the agent plans it, executes it, saves reusable workflows, and can spawn subagents when needed.
- Differentiators:
  - stronger security and approval boundaries than OpenClaw
  - better UX and easier workflow authoring
  - Composio-backed tool execution
  - ability to recommend better/faster/cheaper tools
  - token-aligned usage model

## Non-Negotiables
- Financial actions must start with hard caps and approval gates.
- Read/write scopes must be explicit per tool, workflow, and user.
- Payment and trading actions need audit logs.
- Workflow creation must feel natural in chat, not like programming.
- Scheduling should prefer GitHub Actions over ad-hoc cron where practical.
- Token pricing must cover infra even with the current 70% burn mechanic.

## Phase 1 Wedge
Do not try to build the full employee agent all at once.

Ship a crypto-native operator that is great at:
1. research + summarization + tool usage
2. workflow creation from chat
3. monitoring + alerts + recurring automations
4. guarded crypto actions under strict limits

Treat credit-card payments as a later, higher-trust phase unless a narrow safe use case emerges sooner.

## Definition of Success
Within 90 days, the product should:
- save the founder meaningful time every week
- run at least 3 recurring workflows reliably
- support guarded financial actions with clear approval UX
- be useful enough that the founder would miss it if it disappeared
- be structured well enough to onboard early external users in the pump.fun ecosystem

## Core Capabilities
### 1. Chat-to-Workflow
- User describes a goal in chat.
- Agent proposes a plan with tools, approvals, costs, and schedule.
- User can run once, edit, or save as a workflow.
- Saved workflows can be triggered manually, by schedule, or by events.

### 2. Tool Intelligence
- Agent selects tools based on speed, cost, reliability, and permissions.
- If a better tool exists, the agent should recommend switching.
- Eventually maintain lightweight tool rankings and fallback choices.

### 3. Subagents
- Main agent delegates bounded tasks to specialist subagents.
- Good early subagent roles:
  - researcher
  - execution operator
  - workflow builder
  - safety/compliance checker
  - reporting/summarizer

### 4. Financial Guardrails
- Require explicit policies before any money movement.
- Start with:
  - per-transaction caps
  - daily caps
  - allowlists for payees, wallets, and exchanges
  - mandatory approval for new destinations
  - dry-run/simulation mode where possible
- Make limits easy to raise later after testing.

### 5. Tokenized Usage
- Token spend should map to product usage in a way that still covers infra.
- Likely direction:
  - usage credits backed by token spend
  - admin-controlled pricing per workflow/action/model tier
  - premium access or higher limits for token holders later

## Architecture Directions
### A. Workflow Runtime
- Chat creates a normalized workflow object.
- Workflow object stores steps, tools, permissions, triggers, budgets, and outputs.
- Execution engine runs steps with approval checkpoints.

### B. Scheduling
- Prefer GitHub Actions for recurring jobs where repo-native execution is acceptable.
- Keep a separate runtime path for interactive or stateful workflows that do not fit Actions.

### C. Safety Layer
- Add a policy engine between agent intent and tool execution.
- Policy engine decides: allow, require approval, deny, simulate.

### D. Observability
- Every workflow run should capture:
  - steps attempted
  - tools used
  - approvals requested
  - costs incurred
  - final outcome

## Phased Roadmap
### Phase 1: Useful Operator Core (✅ COMPLETED)
- [x] chat-to-workflow UX
- [x] saved workflows
- [x] GitHub Actions-backed scheduling for safe recurring jobs
- [x] Composio tool execution improvements
- [x] approval gate + transaction caps
- [x] basic wallet/trade guardrails

### Phase 2: Employee Behavior (IN PROGRESS)
- [ ] subagent orchestration (WP7 logic implemented, refinement ongoing)
- [ ] persistent memory and preferences
- [ ] better tool recommendation logic (WP6 implemented)
- [ ] richer dashboard for active workflows, alerts, and outcomes (WP9 implemented)

### Phase 3: High-Trust Actions (PLANNED)
- [ ] more advanced live trading
- [ ] carefully scoped payment flows
- [ ] policy tuning and limit management UI
- [ ] stronger billing/token integration

## Work Packages (Wedge Status)

### WP1. Chat-to-Workflow Compiler (✅ ACCEPTED)
- Outcome: user can describe a workflow in chat and get a structured plan back.
- Status: Implemented in `src/app/api/chat/route.ts` and `src/lib/workflows/compiler.ts`.

### WP2. Workflow Persistence + Runner (✅ ACCEPTED)
- Outcome: workflows can be saved and executed reliably.
- Status: Implemented in `src/lib/workflows/persistence.ts` and `src/lib/workflows/service.ts`.

### WP3. Approval + Policy Engine (✅ ACCEPTED)
- Outcome: all risky actions pass through a central decision layer.
- Status: Implemented in `src/lib/policy/engine.ts` and `src/lib/policy/service.ts`.

### WP4. Crypto Guardrails (✅ ACCEPTED)
- Outcome: crypto actions work only within strict configurable limits.
- Status: Implemented in `src/lib/crypto/guardrails.ts` and `src/lib/crypto/service.ts`.

### WP5. Scheduling via GitHub Actions (✅ ACCEPTED)
- Outcome: recurring safe workflows run on schedules without custom cron infra.
- Status: Implemented in `src/lib/workflows/scheduling.ts`.

### WP6. Tool Recommendation Layer (✅ ACCEPTED)
- Outcome: the agent suggests better tools when appropriate.
- Status: Implemented in `src/lib/workflows/tool-recommendations.ts`.

### WP7. Subagent Orchestration (✅ ACCEPTED)
- Outcome: main agent can spawn specialists with bounded scope.
- Status: Implemented in `src/lib/orchestration/tools.ts`.

### WP8. Token Billing + Usage Accounting (✅ ACCEPTED)
- Outcome: usage is priced in a way that supports infra and the burn mechanic.
- Status: Implemented in `src/lib/credits/engine.ts` and `src/lib/credits/estimator.ts`.

### WP9. UX Simplification Pass (✅ ACCEPTED)
- Outcome: the product feels simpler and more intuitive than OpenClaw.
- Design Specs:
  - **Consolidated Progress Card:** Chat-native component showing parallel specialist status with step-by-step streaming feedback.
  - **State Matrix:** Use `cyber-green` for completion, `warning-amber` for blocked/partial, and `danger-red` for failed tasks.
  - **Mobile Layout:** Adaptive "Employee Feed" view emphasizing vertical progress.
- Status: Initial logic implemented; UI components being drafted per `DESIGN.md`.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 4/10 → 9/10, 6 decisions |

**VERDICT:** DESIGN CLEARED — ready to implement UI components.

## Recommended Order of Execution
1. WP1 Chat-to-Workflow Compiler
2. WP2 Workflow Persistence + Runner
3. WP3 Approval + Policy Engine
4. WP4 Crypto Guardrails
5. WP5 Scheduling via GitHub Actions
6. WP9 UX Simplification Pass
7. WP7 Subagent Orchestration
8. WP6 Tool Recommendation Layer
9. WP8 Token Billing + Usage Accounting

## Immediate Sprint Plan
### Sprint A: Make the system feel real
- build workflow schema
- convert chat requests into structured plans
- let users save and re-run workflows

### Sprint B: Make it safe
- centralize approval decisions
- add hard transaction caps
- add logs for every risky action

### Sprint C: Make it sticky
- add scheduled recurring workflows
- add subagent support for research/execution/reporting
- add tool-improvement suggestions

## Open Questions to Resolve Later
- exact token pricing formula relative to model/tool costs
- which financial actions are allowed in the first live release
- when to introduce credit-card payments
- how much multi-tenant complexity is needed in phase 1
- whether workflow scheduling should also support non-GitHub runtimes from day one

## Hand-off Instructions for Other Agents
When assigning work, give each agent:
1. one work package only
2. the definition of done from this plan
3. the relevant files and constraints
4. a requirement to add or update tests
5. a requirement to write a short handoff note with decisions and remaining risks

## Recommendation
If speed matters most, focus the next implementation push on WP1 + WP2 + WP3.

That sequence creates the backbone of the product:
- chat describes work
- workflows become durable objects
- risky actions are governed centrally

Everything else becomes much easier once that spine exists.