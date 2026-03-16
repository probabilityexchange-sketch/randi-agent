#!/bin/bash
set -euo pipefail

echo "========================================="
echo "  Agent Platform - Deploy Script"
echo "========================================="

# Configuration
PUBLIC_IP=$(curl -s https://ifconfig.me || echo "localhost")
DB_USER="agentplatform"
DB_NAME="agentplatform"
DB_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
TREASURY_WALLET="${TREASURY_WALLET:?ERROR: TREASURY_WALLET environment variable must be set}"

# Validate required Cloudflare credentials for HTTPS cert generation
if [ -z "${CF_API_EMAIL:-}" ]; then
  echo "ERROR: CF_API_EMAIL environment variable is not set."
  echo "  This is required for Let's Encrypt certificate generation via Cloudflare DNS challenge."
  echo "  Export it before running this script: export CF_API_EMAIL=\"your@email.com\""
  exit 1
fi

if [ -z "${CF_DNS_API_TOKEN:-}" ]; then
  echo "ERROR: CF_DNS_API_TOKEN environment variable is not set."
  echo "  This is required for Let's Encrypt certificate generation via Cloudflare DNS challenge."
  echo "  Export it before running this script: export CF_DNS_API_TOKEN=\"your-token\""
  exit 1
fi

# --- 1. Install Docker if needed ---
if ! command -v docker &> /dev/null; then
  echo "[1/7] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
else
  echo "[1/7] Docker already installed"
fi

if ! docker compose version &> /dev/null; then
  echo "  Installing Docker Compose plugin..."
  sudo yum install -y docker-compose-plugin
fi

echo "  $(docker --version)"
echo "  $(docker compose version)"

# --- 2. Project setup ---
echo "[2/7] Setting up project..."
# Assume script is run from project root

# --- 3. Create .env ---
echo "[3/7] Configuring environment..."

if [ -f .env ]; then
  echo "  .env already exists, backing up to .env.bak"
  cp .env .env.bak
fi

cat > .env << ENVEOF
# Database
DB_USER="${DB_USER}"
DB_NAME="${DB_NAME}"
DB_PASSWORD="${DB_PASSWORD}"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}?schema=public"

# Domain
NEXT_PUBLIC_DOMAIN="${PUBLIC_IP}"

# JWT
JWT_SECRET="${JWT_SECRET}"

# Solana
NEXT_PUBLIC_SOLANA_NETWORK="devnet"
NEXT_PUBLIC_SOLANA_RPC_URL="https://api.devnet.solana.com"
SOLANA_RPC_URL="https://api.devnet.solana.com"

# SPL Token
TOKEN_MINT="So11111111111111111111111111111111111111112"
NEXT_PUBLIC_TOKEN_MINT="So11111111111111111111111111111111111111112"
TOKEN_DECIMALS="9"
TREASURY_WALLET="${TREASURY_WALLET}"

# Docker
DOCKER_SOCKET="/var/run/docker.sock"
DOCKER_NETWORK="traefik-net"
TRAEFIK_NETWORK="traefik-net"

# Container defaults
CONTAINER_MAX_MEMORY="4294967296"
CONTAINER_MAX_CPU="2000000000"
CONTAINER_PID_LIMIT="256"
CONTAINER_DEFAULT_HOURS="4"

# Agent images
AGENT_ZERO_IMAGE="frdel/agent-zero:latest"
OPENCLAW_IMAGE="openclaw/openclaw:latest"

# Cloudflare
CF_API_EMAIL="${CF_API_EMAIL}"
CF_DNS_API_TOKEN="${CF_DNS_API_TOKEN}"
ENVEOF

echo "  .env created with generated secrets"

# --- 4. Traefik setup ---
echo "[4/7] Setting up Traefik..."
mkdir -p traefik/acme
touch traefik/acme/acme.json
chmod 600 traefik/acme/acme.json

# --- 5. Build and launch ---
echo "[5/7] Building and launching..."
docker compose up -d --build

echo "  Waiting for services to be healthy..."
sleep 10

# Wait for db to be ready
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U "${DB_USER}" &> /dev/null; then
    echo "  Database is ready"
    break
  fi
  echo "  Waiting for database... ($i/30)"
  sleep 2
done

# Wait for app to be ready
for i in $(seq 1 30); do
  if docker compose exec -T app wget -qO- http://localhost:3000 &> /dev/null 2>&1; then
    echo "  App is ready"
    break
  fi
  echo "  Waiting for app... ($i/30)"
  sleep 3
done

# --- 6. Database setup ---
echo "[6/7] Setting up database..."
docker compose exec -T app node ./node_modules/prisma/build/index.js db push --schema=/app/prisma/schema.prisma
docker compose exec -T app node ./node_modules/prisma/build/index.js db seed --schema=/app/prisma/schema.prisma || echo "  Seed skipped (no seed configured)"

# --- 7. Network security ---
echo "[7/7] Setting up network policies..."
if [ -f scripts/setup-iptables.sh ]; then
  bash scripts/setup-iptables.sh || echo "  Warning: iptables setup failed"
fi

# --- Done ---
echo ""
echo "========================================="
echo "  Deployment complete!"
echo "========================================="
echo ""
echo "  Site: http://${PUBLIC_IP}"
echo ""
echo "  Next steps:"
echo "  1. Point your domain to ${PUBLIC_IP}"
echo "  2. Update NEXT_PUBLIC_DOMAIN in .env"
echo "  3. Restart: docker compose up -d"
echo ""
