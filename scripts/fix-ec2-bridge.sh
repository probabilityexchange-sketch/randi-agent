#!/bin/bash
set -euo pipefail

echo "=========================================================="
echo "🚀 Randi Agent Platform: EC2 Bridge Reliability Fix Script"
echo "=========================================================="
echo "This script will resolve the 'ao session ls' crash and"
echo "improve the resilience of the EC2 bridge and dashboard."
echo ""

# 1. Update Node.js via NVM (Fixes commander.js version mismatches for AO CLI)
echo "[1/4] Ensuring Node.js environment is up to date (v20+)..."
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
    nvm alias default 20
else
    echo "NVM not found. Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    source "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
    nvm alias default 20
fi

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 2. Install PM2 for Process Resilience
echo "[2/4] Installing PM2 globally..."
npm install -g pm2
# Ensure PM2 starts on boot
pm2 startup | tail -n 1 | bash || true

# 3. Fix AO CLI Dependencies
echo "[3/4] Updating dependencies in agent-orchestrator..."
if [ -d "$HOME/agent-orchestrator" ]; then
    cd "$HOME/agent-orchestrator"
    # Ensure pnpm is installed if they use it
    npm install -g pnpm
    pnpm install
    # Link the AO CLI again to ensure it uses the updated node runtime
    npm link || true
else
    echo "⚠️ Warning: ~/agent-orchestrator directory not found. Skipping AO CLI update."
fi

# 4. Configure PM2 Services
echo "[4/4] Configuring services with PM2..."

# Stop any existing processes
sudo pkill -9 node || true
pm2 delete all || true

# Start Bridge Server
if [ -d "$HOME/bridge" ]; then
    cd "$HOME/bridge"
    pm2 start server.js --name "bridge-server" --env BRIDGE_API_KEY="$BRIDGE_API_KEY"
else
    echo "⚠️ Warning: ~/bridge directory not found. Skipping bridge server."
fi

# Start Dashboard Server
if [ -d "$HOME/agent-orchestrator" ]; then
    cd "$HOME/agent-orchestrator"
    pm2 start "pnpm run dev" --name "ao-dashboard"
else
    echo "⚠️ Warning: ~/agent-orchestrator directory not found. Skipping dashboard server."
fi

# Save PM2 state
pm2 save

echo "=========================================================="
echo "✅ EC2 Fix applied successfully."
echo "You can check service status with: pm2 status"
echo "You can check logs with: pm2 logs"
echo "=========================================================="
