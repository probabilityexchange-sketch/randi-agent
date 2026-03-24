#!/usr/bin/env bash
set -euo pipefail

npx tsx scripts/swap-db.ts postgresql
npx prisma generate

# NOTE: prisma db push is intentionally skipped here.
# Vercel's build network cannot reach the Supabase database server directly.
# Run `npx prisma db push` locally to apply schema changes to the database.

next build
