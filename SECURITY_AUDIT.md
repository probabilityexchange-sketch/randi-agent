# SECURITY_AUDIT

Prioritized risks reviewed in this repo, focused on money movement and production deployment safety.

## Critical

1. **Payment replay/double-credit risk (fixed in this PR)**
   - Previous flow accepted pending purchase by memo and could be raced.
   - Added purchase intents with unique tx signature + unique ledger intent + row-locked confirmation transaction.

2. **Secrets leaked into Docker build args in CI (fixed in this PR)**
   - Build args can end up in image metadata/layers and are broadly exposed in build context.
   - Deployment workflow now builds without runtime secrets in build args.

3. **DEV auth bypass could be active in production (fixed in this PR)**
   - Production guard now forces bypass off regardless of env flags.

## High

4. **Traefik Host() rule tied to `NEXT_PUBLIC_DOMAIN` (fixed in this PR)**
   - Public URL variables often include scheme/port and can break routing or misroute traffic.
   - Added `APP_HOST` for strict host-only routing.

5. **Docker socket mount in app container (partially addressed with warning)**
   - `/var/run/docker.sock` grants root-equivalent host control if app is compromised.
   - This PR adds explicit warning and recommends retaining only if required for dynamic container lifecycle.

## Medium

6. **Credit accounting mixed usage and purchase transactions**
   - Legacy `CreditTransaction` table stores multiple semantic concerns.
   - New append-only `CreditLedger` for purchase credits reduces audit ambiguity.

7. **Lack of dedicated production hardening checklist**
   - Recommend follow-up: strict CSP, request signing for high-value endpoints, and SIEM audit trail shipping.

