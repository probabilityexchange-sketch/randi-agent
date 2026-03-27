# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1.0] - 2026-03-26

### Added
- **Bridge Node Registry:** New `/api/nodes` admin API for registering and managing bridge nodes in the database. Nodes can be filtered by status and region; CRUD operations are admin-gated.
- **Smart load balancing:** `getBestBridgeNode()` now picks the node with the fewest active containers from live fleet stats, skips nodes at capacity (`totalContainers >= maxContainers`), and resolves URLs via the new node registry — replacing the previous single-node env var approach.
- **Distributed cleanup lock:** `cleanupExpiredContainers` now uses a `CleanupLock` DB record to prevent concurrent runs across multiple processes/pods. Includes stale-lock TTL recovery (10-minute threshold) so a crashed process can't lock cleanup forever.
- **`ApiError` / `wrapRoute` utility:** New `src/lib/utils/api-error.ts` providing structured error responses with status codes and machine-readable error codes, plus a `wrapRoute` wrapper for consistent error handling across API routes.
- **Fleet Dashboard (`/fleet`):** New fleet management UI with consolidated progress cards and a grid view of all your agents — see container counts, status, and node health at a glance.
- **`BridgeNode` and `CleanupLock` Prisma models:** Schema additions backing the new registry and distributed lock.

### Fixed
- **Auth gates:** `/api/agentcard/create` and `/api/fleet/metrics` were unauthenticated — both now require a valid session.
- **Auth pattern:** All new API routes previously used dead-code auth check (`if (auth instanceof NextResponse)`) since `requireAuth()` throws rather than returns. Fixed to use try/catch + `handleAuthError`.
- **`apiKey` exposure:** Bridge node API keys were being returned in GET list and PUT responses. Now redacted from all responses.
- **Bridge removal race:** When bridge container removal failed, the DB record was still marked `EXPIRED`. Now only marks `EXPIRED` on confirmed removal; leaves `RUNNING` for retry on failure.
- **N+1 orphan scan:** Cleanup orphan detection previously issued one `findUnique` per Docker container. Replaced with a single batched `findMany`.
- **TOCTOU on node registration:** `POST /api/nodes` previously pre-checked uniqueness with `findUnique` then `create`, creating a race window. Now catches Prisma P2002 directly for atomic 409.
- **Input validation:** `GET /api/fleet/metrics` now validates `since` (returns 400 on invalid date) and guards `parseInt(limit)` against `NaN`.
- **`maxContainers` validation:** `POST/PUT /api/nodes` now validates `maxContainers` is a positive number ≤ 1000.
- **CSO findings (previous sprint):** Path traversal, access control on 4 routes, and specialist cap removed — all resolved.

### Changed
- `composio/client.ts`: `apiKey` moved inside `getComposioClient()` function scope so it reads from the live env var each call rather than at module load time.
- `payments/scanner.ts`: N+1 pattern replaced with batch pre-fetch of already-processed signatures.

