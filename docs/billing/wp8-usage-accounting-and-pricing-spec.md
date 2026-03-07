# WP8 - Usage Accounting and Pricing Discovery Spec

**Work Package**: WP8 - Usage Accounting and Pricing  
**Phase**: Discovery / Spec Pass  
**Date**: 2026-03-06  
**Status**: Accepted and Implemented

---

## 1. Executive Summary

This spec defines the minimal implementation path to satisfy WP8 requirements: **cost per run can be estimated before execution and logged after**. The current codebase has partial usage accounting but lacks complete per-workflow-run cost tracking and estimation.

**Key Finding**: "Credits" and "$RANDI token balance" are functionally the same unit in the current code - both are stored as whole tokens in `User.tokenBalance`. No separate "credit" currency exists.

---

## 2. Current-State Findings

### 2.1 How Usage Accounting Works Today

| Component | Location | Status |
|-----------|----------|--------|
| Token balance | `User.tokenBalance` (int) | ✅ Tracks user credits |
| Deduction engine | `src/lib/credits/engine.ts` | ✅ Core `deductForAgentCall()` |
| Pricing model | `src/lib/tokenomics.ts` | ✅ Tiers: STANDARD/PREMIUM/ULTRA |
| Burn mechanism | 70% burn / 30% treasury split with optional batch on-chain execution | ✅ Implemented |
| Transaction log | `TokenTransaction` table | ✅ PURCHASE, USAGE, REFUND, SUBSCRIBE |
| Chat session tracking | `ChatSession.tokensUsed` | ✅ Cumulative per session |
| Container tracking | `Container.tokensUsed` | ✅ Pre-reserved + trackable |

### 2.2 Current Deduction Points

1. **Chat API** (`src/app/api/chat/route.ts:116`): Deducts before LLM call based on model tier
2. **Telegram Webhook** (`src/app/api/telegram/webhook/route.ts:70`): Deducts per Telegram interaction
3. **Orchestration Tools** (`src/lib/orchestration/tools.ts:386`): Deducts for specialist delegate calls
4. **Container Provisioning** (`src/app/api/containers/route.ts:156-184`): Pre-reserves tokens for runtime
5. **Container Lifecycle** (`src/lib/docker/lifecycle.ts`): Handles refunds for early stop

### 2.3 Purchase and Verification Flow (Existing)

- **Purchase intent**: `src/app/api/credits/purchase/route.ts` creates pending `TokenTransaction`
- **Verification**: `src/app/api/credits/verify/route.ts` confirms on-chain and updates balance
- **Token pricing**: `src/lib/payments/token-pricing.ts` fetches DexScreener prices

### 2.4 What Is Missing for WP8

| Gap | Description | Impact |
|-----|-------------|--------|
| **No workflow cost estimation** | Cannot estimate total cost before workflow runs | Users can't preview costs |
| **No workflow cost logging** | `WorkflowRun` has no cost fields | No post-run actual cost tracking |
| **No tool-cost catalog** | No registry of tool execution costs | Can't estimate workflow total |
| **No scheduling cost estimation** | Can't estimate monthly cost for scheduled workflows | Users blind to recurring costs |
| **Specialist call aggregation** | Specialists deduct but don't log per-call in workflow context | Workflow cost = sum of deductions |

### 2.5 Tokenomics Already in Place

```
STANDARD tier:  5,000 tokens/call
PREMIUM tier:  30,000 tokens/call  
ULTRA tier:    150,000 tokens/call

Burn: 70% → incinerator
Treasury: 30% → platform运营
```

---

## 3. Proposed WP8 Specification

### 3.1 Source of Truth for Usage Metering

**Primary**: `User.tokenBalance` for current balance  
**Transaction Log**: `TokenTransaction` table for history  
**Session Aggregation**: `ChatSession.tokensUsed` for chat costs  
**Container Tracking**: `Container.tokensUsed` for runtime costs  

**Recommendation**: No change to existing tables. Add new fields to `WorkflowRun` for workflow-specific tracking.

### 3.2 Pricing Model Boundaries

| Boundary | Definition |
|----------|------------|
| **Model cost** | Fixed per tier via `getCallCost()` in `src/lib/tokenomics.ts` |
| **Tool cost** | Not currently priced - **gap** |
| **Container runtime** | `agent.tokensPerHour` known at provisioning |
| **Burn split** | 70/30 fixed in `BURN_BPS` constant |

**What stays fixed**: Model tier pricing  
**What needs definition**: Tool execution cost catalog (future phase)

### 3.3 Token-to-Credit Accounting Design

**Current alignment is complete**:
- `User.tokenBalance` = credit balance (same unit)
- No separate "credits" currency exists
- `TokenTransaction.type=USAGE` logs every deduction
- Burn accounting is determined at deduction time; on-chain burn execution happens later via the burn service when cron and treasury signing are configured

**Recommendation**: No accounting model changes needed. Current design is sound.

### 3.4 Pre-Execution Estimation Approach

| Scenario | Estimation Available? | How |
|----------|----------------------|-----|
| Single chat call | ✅ Yes | `getCallCost(model)` |
| Specialist delegation | ✅ Yes | `getCallCost(agent.defaultModel)` |
| Container provisioning | ✅ Yes | `hours * agent.tokensPerHour` |
| **Workflow run** | ❌ No | **Needs new code** |
| **Scheduled workflow** | ❌ No | **Needs new code** |

**Minimal Implementation for Pre-Run Estimation**:

1. **Add fields to WorkflowRun** (Prisma):
   ```prisma
   model WorkflowRun {
     // ... existing fields
     costEstimate Int?    // Estimated tokens for this run
     costActual   Int?   // Actual tokens consumed
   }
   ```

2. **Create estimation function** in `src/lib/credits/estimator.ts`:
   - Sum model costs for each step
   - For now, estimate tool costs as zero (future: add tool-cost catalog)
   - Return `{ estimate: number, breakdown: StepCost[] }`

3. **Call estimator before workflow execution** in workflow service:
   - Display estimate to user before run
   - Store in `WorkflowRun.costEstimate`

### 3.5 Post-Execution Logging Approach

| Scenario | Logging Available? | How |
|----------|--------------------|-----|
| Chat session | ✅ Yes | `ChatSession.tokensUsed` cumulative |
| Specialist call | ✅ Yes | `TokenTransaction` with USAGE type |
| Container runtime | ✅ Yes | `Container.tokensUsed` |
| **Workflow run** | ❌ No | **Needs new code** |

**Minimal Implementation for Post-Run Logging**:

1. **Update WorkflowRun after completion**:
   - Sum all `TokenTransaction.USAGE` records created during workflow execution
   - Or: Aggregate from child `ChatSession.tokensUsed` if chat-based
   - Store in `WorkflowRun.costActual`

2. **Add helper function** in `src/lib/credits/engine.ts`:
   ```typescript
   export async function logWorkflowRunCost(
     workflowRunId: string, 
     userId: string
   ): Promise<number>
   ```

### 3.6 Minimal Implementation Sequence

**Phase 1: Schema Changes (1 day)**
1. Add `costEstimate` and `costActual` fields to `WorkflowRun` in `prisma/schema.prisma`

**Phase 2: Estimation Service (2 days)**
2. Create `src/lib/credits/estimator.ts`
   - Export `estimateWorkflowCost(workflowId: string): { estimate: number, breakdown: StepCost[] }`
   - Use existing `getCallCost()` for model costs
   - Default tool costs to 0 (explicit "estimate only")

**Phase 3: Execution Integration (2 days)**
3. Update workflow runner to call estimator before execution
4. Store estimate in `WorkflowRun.costEstimate`
5. Update workflow completion to calculate actual and store in `WorkflowRun.costActual`

**Phase 4: UI Display (1 day)**
6. Update frontend to show estimate before run
7. Show actual cost after completion

**Total Estimate**: 6 implementation days

---

## 4. Safety / Non-Negotiable Handling

### 4.1 Preserving Current Guardrails

| Guardrail | Location | Preserved? |
|-----------|----------|------------|
| Hard caps | WP4 CryptoGuardrailConfig | ✅ No changes needed |
| Approval gates | WP3 ApprovalRequest | ✅ No changes needed |
| Burn mechanic | 70% in tokenomics.ts | ✅ Unchanged |
| Treasury split | 30% in tokenomics.ts | ✅ Unchanged |

### 4.2 Avoiding Misleading Cost Promises

**Critical Rule**: Estimation must be explicit about what is NOT included.

```
ESTIMATE: ~15,000 tokens
- Chat model (PREMIUM): 30,000 × 1 call = 30,000
- Tool costs: NOT YET PRICED
- External API calls: NOT YET PRICED

⚠️ This is a minimum estimate. Actual costs may be higher.
```

**Implementation must include**:
- Clear disclaimer in estimation output
- Conservative default (show higher of estimate vs. balance check)
- Never promise exact costs for workflows with external dependencies

### 4.3 What Remains Intentionally Limited

| Limitation | Reason |
|-----------|--------|
| Tool cost catalog | Deferred to future phase - requires Composio cost data |
| External API pricing (x402) | Out of scope for WP8 - covered by separate WP |
| Credit-card payments | Not in WP8 scope - later phase |
| Dynamic pricing | Fixed tiers are simpler and more predictable |

---

## 5. Alignment with Other Work Packages

| WP | Relationship | Impact on WP8 |
|----|--------------|---------------|
| WP4 (Crypto Guardrails) | Uses same transaction log | No conflicts |
| WP5 (Scheduling) | Scheduled runs need cost estimation | WP8 enables WP5 cost preview |
| WP6 (Tool Recommendation) | Could use cost data for recommendations | No conflicts |
| WP7 (Subagents) | Delegates charge via existing flow | Already tracked |
| WP9 (UX) | Will display cost estimates | WP8 provides data |

**No breaking changes required** to any existing WP4-WP9 work.

---

## 6. Open Questions / Blockers

### 6.1 Still Ambiguous in Current Repo

| Question | Current State | Recommendation |
|----------|---------------|----------------|
| Tool execution costs | Not tracked anywhere | Accept "estimate only" for v1 |
| Composio API costs | Unknown | Defer to Composio partnership |
| Workflow step retry costs | Not tracked | Count retries in actual cost |

### 6.2 Intentionally Deferred

| Item | Reason |
|------|--------|
| Per-tool cost catalog | Requires vendor data, not available |
| Dynamic model pricing | Fixed tiers are stable |
| Usage-based burn adjustment | 70% burn is policy, not variable |

---

## 7. Validation Commands

Since this is a **spec-only pass** with no code changes, validation commands are N/A.

If implementing:
```bash
# Schema validation
npx prisma validate

# Type check
npm run typecheck
# or
npx tsc --noEmit
```

---

## 8. Recommended Next Step

**Status**: ✅ WP8 spec is ready for implementation

**Next Phase**: Implementation can begin with:
1. Prisma schema update (add `costEstimate` and `costActual` to `WorkflowRun`)
2. Create `src/lib/credits/estimator.ts`
3. Integrate estimation into workflow runner
4. Add logging on workflow completion

**No additional discovery passes needed** - the current codebase provides sufficient clarity for implementation.
