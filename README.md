<div align="center">
  <img src=".github/assets/banner.png" alt="Randi Agent Banner" width="100%">

  # 🤖 Randi Agent Platform
  
  **The enterprise-grade AI agent orchestration layer powered by Solana, Composio, and early x402 support.**

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
  [![Solana](https://img.shields.io/badge/Solana-Protocol-blue?logo=solana)](https://solana.com/)
  [![Auth: Privy](https://img.shields.io/badge/Auth-Privy-indigo)](https://www.privy.io/)
  [![Docker](https://img.shields.io/badge/Docker-Enabled-blue?logo=docker)](https://www.docker.com/)

  [Explore Docs](docs/USER_GUIDE.md) · [Report Bug](../../issues/new?template=bug_report.yml) · [Request Feature](../../issues/new?template=feature_request.yml) · [Support on Ko-fi](https://ko-fi.com/randiagent)
</div>

---

## 🌟 Overview

Randi is a high-performance AI agent platform designed for secure orchestration, credit-backed usage, early machine-to-machine (M2M) payment support, and containerized agent execution. It bridges the gap between high-level AI reasoning (LLMs) and low-level system integrations using **Composio**, **Solana**, and initial **x402** groundwork.

### 💎 The Randi Economy

The platform is powered by a multi-tier economic model designed for autonomous agent operations:
1.  **Hosted Platform**: Access the managed environment at [randi.chat](https://www.randi.chat/), fueled by the **$RANDI** token on Solana.
2.  **Verified Credits**: Users top up their balance with $RANDI to fund LLM reasoning and container compute.
3.  **x402 Protocol**: Initial support for autonomous machine-to-machine payments for premium AI services.
4.  **Open Source**: Fully self-hostable for developers who want to run their own private agent fleet.

### 🛡️ The Randi Difference

Randi adopts a **security-first** approach to agentic workflows:

*   **Hardened Isolation**: While standard frameworks execute tools in shared spaces, Randi supports **isolated Docker containers** on AWS EC2 for intensive agent tasks.
*   **Trustless Orchestration**: Native **Privy authentication** supports secure wallet-based and social/email sign-in for agent fleet management.
*   **Infrastructure over Interfaces**: Randi is designed as an **orchestration layer**, focusing on fleet health, container lifecycles, and verified credit ledgers.

### 🚀 Key Capabilities

- 💬 **Unified AI Chat**: Real-time interaction with multiple specialized agents using streaming LLM outputs.
- 🏗️ **On-Demand Compute**: Launch dedicated, containerized agent instances with unique URLs for complex coding and system tasks.
- 🧰 **Extensible Skills**: 100+ out-of-the-box toolkits via Composio, including GitHub, Slack, and Financial APIs.
- 💳 **Credit-Backed Usage**: Token-gated access with automated burn mechanics and verified on-chain deposits.
- ⛓️ **Web3 Native**: Built-in support for Solana wallet connections and early x402 payment support.
- 🤖 **Telegram Integration**: Control your agents and receive real-time updates via personal Telegram bots.
- 🖥️ **Fleet Dashboard**: Real-time visibility into your entire bridge node fleet at `/fleet` — agent health, container counts, and status at a glance.

---

## 🚦 Current Development State

The platform has successfully moved through its foundational stages and is currently in **Phase 6+: Scaling & Resilience**.

- [x] **Universal Auth**: Seamless social and wallet login via Privy.
- [x] **Integrated Chat**: Unified interface for multi-agent conversations with persistent history.
- [x] **Hybrid Compute**: Support for both shared runtimes and dedicated AWS EC2 container bridge nodes.
- [x] **Credit Economy**: Verified $RANDI deposit workflow with automated burn mechanics.
- [x] **x402 Support**: Initial implementation for autonomous M2M model payments.
- [x] **Transparency Hub**: Real-time tracking of platform stats and $RANDI burn schedules.
- [ ] **Next Step**: Full AgentCard integration for traditional fiat-based agent spending.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker (running)
- Optional: Solana wallet for wallet-based flows

### Installation

1. **Clone and Install**
   ```bash
   git clone https://github.com/Randi-Agent/agent-platform.git
   cd agent-platform
   npm install
   ```

2. **Environment Setup**
   Copy `.env.example` to `.env.local` and fill in your credentials (Privy, Supabase, Solana RPC, OpenRouter, Composio).

3. **Initialize Database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Launch Development Server**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to see the platform in action.

---

## 📚 Documentation

Detailed guides and operational playbooks are available in the [docs/](docs/) directory:

### 📖 User & Platform Guides
- **[User Guide](docs/USER_GUIDE.md)**: Getting started with chat, integrations, and credits.
- **[Payments Explainer](docs/PAYMENTS_EXPLAINER.md)**: Deep dive into the $RANDI, x402, and AgentCard economy.
- **[Support & Ticketing](docs/SUPPORT_AND_TICKETING.md)**: How to report bugs and request help.

### 🤖 Agent Architecture & Rules
- **[Agent Rules](docs/AGENT_RULES.md)**: Architectural overview of runtime prompts, skills, and enforcement.
- **[Core Policies](docs/policies/core-rules.md)**: Non-negotiable operating rules for AI agents.
- **[Operational Playbooks](docs/playbooks/how-to-operate-as-randi.md)**: Step-by-step guides for agent behavior and execution.
- **[Tool Catalog](docs/tools/tool-catalog.md)**: Directory of available skills, tools, and integration boundaries.

### 🛠️ Developer & Ops
- **[Developer Guide](docs/PRIVATE_CODE_PUBLIC_SUPPORT_MIGRATION.md)**: Working with the codebase and local setup.
- **[Deployment Runbook](DEPLOYMENT.md)**: AWS EC2 rollout procedures and bridge configuration.
- **[Payment Ops](PAYMENTS.md)**: Managing the $RANDI token economy and burn mechanics.

---

## 🤝 Contributing

We love contributions! Please read our **[Contributing Guidelines](.github/CONTRIBUTING.md)** and **[Code of Conduct](.github/CODE_OF_CONDUCT.md)** before submitting a Pull Request.

---

## 🛡️ Security

If you discover a security vulnerability, please refer to our **[Security Policy](.github/SECURITY.md)**.

---

## ☕ Support the Mission

If you believe in secure, decentralized AI orchestration, consider supporting the Randi Agent platform on Ko-fi. Your contributions directly fund our open-source development and managed hosting infrastructure.

<a href='https://ko-fi.com/O4O31AYXW8' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi3.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

---

## 📜 Attributions & Acknowledgments

Randi Agent stands on the shoulders of giants. We are proud to build upon and integrate with the following open-source projects and platforms:

*   **[Anthropic Agent Skills](https://github.com/anthropics/skills)**: Inspired the foundational logic for our specialized agent skill system.
*   **[Alchemy Skills](https://github.com/alchemyplatform/skills)**: Powers our autonomous wallet authentication and Web3 infrastructure layers.
*   **[Composio](https://github.com/composiohq/composio)**: Provides the robust connectivity layer allowing our agents to interact with 1000+ external tools and SaaS platforms.
*   **[Solana](https://github.com/solana-labs/solana)**: The core protocol enabling our secure payments, $RANDI token economy, and verified deposit workflows.
*   **[Privy](https://www.privy.io/)**: Our primary authentication provider, enabling secure, non-custodial wallet connections and social login.
*   **[OpenClaw](https://github.com/openclaw/openclaw)**: A major inspiration for decentralized AI infrastructure.
*   **[Vercel](https://vercel.com/)**: Our hosting platform for the "Brain" (Next.js application).
*   **[Traefik](https://github.com/traefik/traefik)**: The edge router managing our containerized agent fleet on AWS.
*   **[Clawnch](https://clawn.ch)**: Partner integration for token launch and agent network matching.

---

<div align="center">
  <sub>Built with ❤️ by the Randi Agent Team. &copy; 2026</sub>
  <br />
  <a href="https://t.me/RandiAgent">Join our Telegram</a>
</div>
