# Deployment Guide

This project deploys to AWS EC2 through GitHub Actions and GHCR.

Architecture:

```text
GitHub Push -> GitHub Actions -> Build Image -> Push GHCR -> SSH EC2 -> Pull -> Migrate -> Seed -> Restart -> Verify
```

## Required GitHub Secrets

Configure in GitHub: `Settings -> Secrets and variables -> Actions`.

| Secret | Description | Example |
|--------|-------------|---------|
| `EC2_HOST` | EC2 public IP or DNS | `ec2-1-2-3-4.compute-1.amazonaws.com` |
| `EC2_USER` | SSH user for deployment | `deploy` |
| `EC2_SSH_KEY` | Private SSH key | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `GHCR_PAT` | PAT with `read:packages` | `ghp_xxxx` |

Notes:
- EC2 needs `GHCR_PAT` to pull private GHCR images.
- GitHub Actions can still push with `GITHUB_TOKEN`.

## Image and Service Targets

- Image: `ghcr.io/Randi-Agent/agent-platform`
- Tags: `latest` and `sha-*`
- App container: `agent-platform-web`
- Compose file: `docker-compose.prod.yml`

## AWS/EC2 Rollout Runbook (Token Credits Ledger)

### Ordered Rollout
1. Build and push image to GHCR.
2. Pull image on EC2.
3. Apply database migrations.
4. Run seed.
5. Restart app.
6. Run smoke tests.
7. Run reconciliation checks.

### Prechecks

Run before production rollout:
- [ ] GitHub Actions workflow is green for target commit.
- [ ] Target image exists in GHCR.
- [ ] EC2 SSH access confirmed.
- [ ] Production `.env` includes required auth, Solana, token, and database vars.
- [ ] DB snapshot created immediately before deploy.
- [ ] Current service baseline captured:
  - `docker compose -f docker-compose.prod.yml ps`
  - `docker logs agent-platform-web --tail 200`

### Deployment Commands (EC2)

```bash
ssh deploy@<EC2_HOST>
cd /home/ec2-user/agent-platform

# Ensure GHCR login is valid first (if needed)
docker compose -f docker-compose.prod.yml pull app
docker compose -f docker-compose.prod.yml up -d app

# Schema/data updates
docker compose -f docker-compose.prod.yml exec -T app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec -T app npx prisma db seed

# Confirm status
docker compose -f docker-compose.prod.yml ps
docker logs agent-platform-web --tail 200
```

### Post-Deploy Smoke Tests

Verify the happy-path flow in order:
1. Auth/session works (`/api/auth/me` after login returns 200).
2. Platform config endpoint returns expected values (`/api/config`).
3. Purchase intent create works (`POST /api/purchase-intents`).
4. Purchase intent verify works (`POST /api/purchase-intents/{id}/verify`).
5. Credits balance reflects expected ledger updates (`GET /api/credits/balance`).
6. Credits UI can complete end-to-end flow.
7. Fleet metrics endpoint requires auth (`GET /api/fleet/metrics` should return 401 for unauthenticated requests, 200 after login).
8. No sustained 5xx for auth/credits/purchase-intent routes.

### Focused Smoke Test: Agent Configuration + Devnet Purchase

Use this checklist for the issue you described (agent creates but cannot be configured) and for end-to-end devnet purchase validation.

Preconditions:
- [ ] `.env` has `AGENT_PERSISTENT_STORAGE=true`.
- [ ] `.env` has valid `TOKEN_MINT`, `TREASURY_WALLET`, `NEXT_PUBLIC_SOLANA_NETWORK=devnet`, and `NEXT_PUBLIC_SOLANA_RPC_URL`.
- [ ] Test wallet has both devnet SOL (fees) and the configured token mint balance.
- [ ] App can reach Docker via `DOCKER_HOST` (`http://docker-proxy:2375` in compose deployment).

Agent creation/configuration/persistence:
1. Sign in and set username in dashboard profile.
2. Create one container for `agent-zero` and one for `openclaw`.
3. Open each agent URL and save a visible config artifact:
   - `agent-zero`: create a marker under `/data` (or equivalent settings/state entry).
   - `openclaw`: create a marker under `/app/data` (or equivalent settings/state entry).
4. Stop both containers from dashboard.
5. Recreate the same two agents with the same account.
6. Confirm the saved artifacts are still present.
7. Confirm `GET /api/containers` shows new container records and no `ERROR` status.

Devnet token purchase verification:
1. Open Credits page and buy one package (Small is sufficient).
2. Confirm `POST /api/credits/purchase` returns `transactionId`, `memo`, `tokenMint`, `treasuryWallet`.
3. Sign and submit SPL transfer from test wallet to treasury with the exact `memo`.
4. Confirm `POST /api/credits/verify` returns success and new balance.
5. Refresh Credits page and confirm:
   - balance increased by expected package amount
   - transaction appears as `CONFIRMED`
6. Replay the same verify request and confirm:
   - API returns `409` duplicate/replay protection
   - no additional credits are added
7. Check app logs for errors in auth/credits/purchase-intent routes.

### Reconciliation Checklist

- [ ] Verified purchase intents count matches confirmed credit transactions.
- [ ] No stale `PENDING` intents beyond expected window.
- [ ] No duplicate credits for a single tx signature.
- [ ] No unexpected negative balances.

## Rollback Procedure

If the rollout causes payment/ledger instability:
1. Stop or gate verification traffic path.
2. Roll app image back to previous known-good tag.
3. Restore pre-deploy DB snapshot if schema/data mismatch is present.
4. Re-run smoke tests and reconciliation before closing incident.

---

## Vercel + Supabase Deployment (Modern App)

For the modern chat-centric platform, we recommend Vercel for the frontend/API and Supabase for the PostgreSQL database.

### 1. Supabase Setup
- Create a new project on [Supabase](https://supabase.com).
- Go to `Project Settings -> Database`.
- Copy the **Connection String** (Transaction mode, port 6543) for the `DATABASE_URL`.
- Copy the **Direct Connection String** (port 5432) for `DIRECT_URL`.

### 2. Vercel Environment Variables
Add these to your Vercel project:
- `DATABASE_URL`: Your Supabase transaction pooler URL.
- `DIRECT_URL`: Your Supabase direct connection URL.
- `NEXT_PUBLIC_PRIVY_APP_ID`: From Privy Dashboard.
- `PRIVY_APP_ID`: Server-side Privy app ID fallback.
- `PRIVY_APP_SECRET`: From Privy Dashboard.
- `JWT_SECRET`: A long random string (at least 32 chars).
- `NEXT_PUBLIC_APP_URL`: Your Vercel deployment URL.
- `NEXT_PUBLIC_SOLANA_NETWORK`: Usually `mainnet-beta` in production.
- `NEXT_PUBLIC_SOLANA_RPC_URL`: Public Solana RPC URL for client surfaces.
- `SOLANA_RPC_URL`: Server-side Solana RPC URL.
- `TOKEN_MINT`: Production $RANDI mint.
- `NEXT_PUBLIC_TOKEN_MINT`: Public copy of the same mint.
- `TREASURY_WALLET`: Protocol treasury wallet for purchase verification.
- `PAYMENT_ASSET`: `spl` or `sol`.
- One of:
  - `KILO_API_KEY`
  - `OPENROUTER_API_KEY`
- `COMPOSIO_API_KEY`: Required for Gmail, Calendar, GitHub, and other tool integrations.

Recommended production-only additions:
- `TREASURY_SECRET_KEY`: Required if you want the protocol batch burn job to execute on-chain.
- `CRON_SECRET`: Required to authorize `/api/cron/scan` in production.
- `ADMIN_SECRET`: Required to access the bridge node admin API (`/api/nodes`). Without this, all node registry requests return 403.
- `COMPOSIO_AUTH_CONFIG_GMAIL`: Shared Gmail auth config if you are not using per-user auth.
- `COMPOSIO_AUTH_CONFIG_GOOGLECALENDAR`: Shared Google Calendar auth config if you are not using per-user auth.

### 3. Deploy
- Connect your GitHub repo to Vercel.
- The `vercel.json` included in the root handles the build and prisma generation.

### 4. Database Migration
Run this locally (targeting the remote DB) or via a CI pipeline:
```bash
DATABASE_URL="your_direct_supabase_url" npx prisma db push
```

## Change Ticket Template

Use this for production rollout approvals and audit trail:

```md
Title: Secure token purchase-intent credits ledger rollout (AWS/EC2)

Window:
- Start:
- End:
- Owner:
- On-call:

Scope:
- Commit(s):
- Environment: production

Prechecks:
- [ ] Actions green
- [ ] GHCR image present
- [ ] DB snapshot taken
- [ ] EC2 access verified

Deploy:
- [ ] pull image
- [ ] migrate deploy
- [ ] db seed
- [ ] restart app

Validation:
- [ ] auth check
- [ ] purchase-intent create/verify
- [ ] credits balance correctness
- [ ] logs stable

Rollback ready:
- [ ] previous image tag identified
- [ ] snapshot restore plan confirmed
```
