#!/usr/bin/env bash
set -euo pipefail

npx tsx scripts/swap-db.ts postgresql
npx prisma generate

# Strip accidental "VAR_NAME=" prefixes that can creep in from
# copy-paste errors when setting env vars in dashboards.
sanitize_url() {
  local raw="$1"
  # Remove any leading KEY= prefix (e.g. "DIRECT_URL=postgresql://...")
  local cleaned="${raw#*=postgresql://}"
  if [[ "$cleaned" != "$raw" ]]; then
    cleaned="postgresql://${cleaned}"
  fi
  # Validate it looks like a postgres URL
  if [[ "$cleaned" =~ ^postgres(ql)?:// ]]; then
    echo "$cleaned"
  else
    echo ""
  fi
}

# Prefer non-pooling URL for schema push (DDL needs direct connection)
# We will iterate through candidates and pick the first one that has a password.
CANDIDATES=("POSTGRES_URL_NON_POOLING" "DIRECT_URL" "POSTGRES_PRISMA_URL" "DATABASE_URL")
RAW_URL=""
SELECTED_NAME=""

for name in "${CANDIDATES[@]}"; do
  val="${!name:-}"
  if [[ -n "$val" ]]; then
    # Check if it has a password (postgresql://user:pass@host)
    # We look for a colon after the protocol and before the @
    if [[ "$val" =~ postgresql://[^:]+:[^@]+@ ]]; then
      RAW_URL="$val"
      SELECTED_NAME="$name"
      echo "Found valid database connection string in $name" >&2
      break
    else
      echo "Skipping $name: Missing password in connection string" >&2
    fi
  fi
done

if [[ -z "$RAW_URL" ]]; then
  echo "WARNING: No database URL with a password was found in environment variables." >&2
  echo "  Checked: POSTGRES_URL_NON_POOLING, DIRECT_URL, POSTGRES_PRISMA_URL, DATABASE_URL" >&2
  
  # Final fallback: if POSTGRES_PASSWORD is set, try to use the first non-empty URL
  if [[ -n "${POSTGRES_PASSWORD:-}" ]]; then
    for name in "${CANDIDATES[@]}"; do
      val="${!name:-}"
      if [[ -n "$val" && "$val" =~ ^postgres(ql)?:// ]]; then
        RAW_URL="$val"
        SELECTED_NAME="$name"
        echo "Attempting to use $name with POSTGRES_PASSWORD injection" >&2
        break
      fi
    done
  fi
fi

DB_PUSH_URL="$(sanitize_url "$RAW_URL")"

if [[ -z "$DB_PUSH_URL" ]]; then
  echo "CRITICAL: No database URL found. Database schema cannot be updated." >&2
  echo "  Please set DIRECT_URL or DATABASE_URL in your Vercel environment variables." >&2
  # We continue build but auth will likely fail at runtime
else
  echo "Selected database connection source: $SELECTED_NAME" >&2
  # Debug: Check if the URL contains a password (look for colon after postgresql:// and before @host)
  if [[ "$DB_PUSH_URL" =~ postgresql://[^:]+:@ ]]; then
    if [[ -n "${POSTGRES_PASSWORD:-}" ]]; then
      echo "Injecting POSTGRES_PASSWORD into $SELECTED_NAME..." >&2
      # Inject password between colon and @ (matches the :@ pattern)
      DB_PUSH_URL="${DB_PUSH_URL/:@/:${POSTGRES_PASSWORD}@}"
    else
      echo "ERROR: $SELECTED_NAME is missing a password and POSTGRES_PASSWORD is not set." >&2
      exit 1
    fi
  fi
  echo "Running prisma db push (source: ${DB_PUSH_URL%%@*}@...)" >&2
  if PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1 \
     DATABASE_URL="$DB_PUSH_URL" \
     DIRECT_URL="$DB_PUSH_URL" \
     npx prisma db push --accept-data-loss; then
    echo "Schema push succeeded" >&2
    echo "Regenerating Prisma Client from latest schema..." >&2
    DATABASE_URL="$DB_PUSH_URL" npx prisma generate
    echo "Seeding database..." >&2
    DATABASE_URL="$DB_PUSH_URL" npx prisma db seed
  else
    echo "WARNING: prisma db push failed (tables may already exist) — continuing build" >&2
  fi
fi

next build
