# Handoff: Employee Agent Platform (UI & Test Phase)

## 🎯 Current Mission
We have completed the backend "Rock Solid" hardening. The next mission is to implement the **wp9 UX Simplification Pass** and **Boil the Lake** on the test coverage (currently 22%).

## 🏗️ Architecture & Decisions Made
1. **Multi-Agent Orchestration:** Lead Agent uses `conduct_specialists` for parallel sub-tasks.
2. **Dynamic Load Balancing:** `getBestBridgeNode` routes tasks to the healthiest EC2 node based on container count.
3. **Connection Isolation:** `resolveComposioUserId` now includes `agentSlug` to prevent data leakage between sub-agents.
4. **Pre-flight Safety:** Parallel tasks are blocked if the user's balance is lower than the total estimated cost of all sub-agents.
5. **Cold Start Mitigation:** `prewarm` signal fetches snapshots before the `provision` command arrives.

## 🎨 UI/UX Design Specs (per DESIGN.md)
- **ConsolidatedProgressCard.tsx:** Chat component showing streaming status of parallel specialists.
- **EmployeeFleetGrid.tsx:** Dashboard component for active specialist monitoring.
- **State Matrix:** 
  - `cyber-green` (Success)
  - `warning-amber` (Blocked/Partial)
  - `danger-red` (Failed)
- **Mobile:** Adaptive "Employee Feed" for vertical progress tracking.

## 🧪 Test Requirements (Boil the Lake)
Target: 100% coverage for the following paths:
1. `src/lib/orchestration/tools.ts`:
   - [ ] Insufficient credits rollback in `runSpecialistDelegation`.
   - [ ] `maxTurns` enforcement (test with 1, 5, and 20 turns).
   - [ ] Policy Denied/Approved paths.
   - [ ] Parallel merging in `conduct_specialists`.
2. `src/lib/compute/bridge-client.ts`:
   - [ ] `getBestBridgeNode` logic choosing the node with FEWEST containers.
   - [ ] `prewarm` fetch trigger.
3. `src/lib/composio/client.ts`:
   - [ ] Entity ID isolation (verify `user123_seo_scout` vs `user123_researcher`).

## ⚠️ Known Gaps / Risks
- **Node URL Registry:** Current logic assumes `nodeId` is a URL or uses the default. A `NodeRegistry` DB table is needed for true fleet scalability.
- **Concurrency Caps:** No limit on how many parallel specialists a single user can spawn (beyond credit limits).

## 🚀 Commands
- `npm run test`: Run Vitest suite.
- `npm run dev`: Launch dashboard.
- `npm run employee:auditor`: Test background auditor worker.
