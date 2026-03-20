# 🚀 Randi Agent Platform: Roadmap to randi.chat

This roadmap outlines the strategic phases for evolving the Randi Agent Platform from a functional MVP to a high-scale, distributed AI ecosystem.

## 📍 Phase 1: Launch Foundations (Current Focus)

**Objective**: Stabilize the user experience and secure the primary domain.

- [x] **Universal Auth**: Social + Wallet login via Privy.
- [x] **Web Performance**: Next.js 16 + Turbopack optimization.
- [x] **Transparency Hub**: Real-time token burn and platform stats dashboard.
- [x] **Vercel/Supabase Migration**: Cloud-native hosting with localized Ohio latency tuning.
- [x] **Custom Domain**: Launch `randi.chat` with Cloudflare SSL.
- [x] **Credits 1.0**: Finalize internal credit purchasing and balance tracking.
- [x] **UX & Runtime Resilience**: Decouple chat from provisioning to ensure zero-block user experience.
- [x] **Platform Explainer**: Launch the "How it Works" hub with the Three-Tier Economy breakdown ($RANDI, x402, AgentCard).

## 🏗️ Phase 2: The "Body" (Compute Layer)

**Objective**: Connect the Vercel "Brain" to the AWS "Body" for code execution.

- [x] **Secure Docker Bridge**: Implement a secure API gateway between Vercel and AWS EC2. (Deployed in **us-east-2 Ohio** for minimum latency).
- [x] **Remote Compute Bridge v1.0**: Express-based bridge on EC2 receiving `/spawn-ao` commands with API key protection.
- [x] **Autonomous AO Sessions**: Integrated Composio Agent Orchestrator (`ao`) for repository-level coding tasks on EC2.
- [x] **Ephemeral Sandboxing**: Automated lifecycle management for user containers (Auto-start/Auto-stop).
- [x] **Persistent Storage**: S3/Supabase Storage integration for agent-generated files. (Supabase snapshot upload/restore implemented via bridge snapshots).
- [x] **Fleet Monitoring**: Real-time dashboard for tracking CPU/RAM/Traffic across all bridge nodes.

## 💰 Phase 3: Financial & Tokenomics Layer

**Objective**: Integrate the $RANDI token deeply into the platform's DNA.

- [x] **On-Chain Verification**: Robust Solana transaction scanning for credit top-ups.
- [x] **x402 Protocol Integration**: Initial implementation of the x402 payment standard for premium AI model access.
- [x] **Automated Burn Mechanics**: Real-time $RANDI burning on credit deposits (70% burn).
- [x] **Passive Staking Yield**: Stakers earn up to 200,000 daily platform credits.
- [x] **Credit Subscriptions**: Monthly $RANDI credit subscriptions for power users.
- [ ] **Referral System**: Token-based incentives for user growth. (Planned for Phase 2 Growth)
- [ ] **AgentCard Integration**: Issue virtual cards for agents to pay for API/cloud services. (Next Step)
- [ ] **Gasless Transactions**: Leverage Alchemy Agentic Gateway so Randi can sign transactions without user ETH.

## 🧠 Phase 4: Advanced Intelligence & UI

**Objective**: Transform from simple chat to complex agentic workflows.

- [x] **Composio Expansion**: Add 50+ specialized toolkits (GitHub, Google Workspace, Financial APIs).
- [x] **Randi Orchestration**: "Lead Agent" pattern implemented—specialist subagents are hidden from the UI and called in the background via delegation.
- [x] **Telegram Connectivity**: Inbound/Outbound bot routing live. Users can control Randi via their own personal Telegram bots.
- [x] **Bot Onboarding**: Integrated tutorial in the dashboard for linking bots via BotFather.
- [x] **Cross-Model Compatibility**: Custom XML parser for Minimax and other non-standard LLM tool outputs.
- [x] **Persistent Chat History**: Full persistence of assistant tool calls and multi-turn tool results (40-message window).
- [x] **Human-in-the-loop**: Approval UI for sensitive agent actions with `ToolApproval` persistence.
- [x] **Trading & Data Expansion**: Integrated OpenWeather (Real-time data), Hummingbot (CEX/DEX Trading Core), and Polymarket (Prediction Markets).
- [ ] **OpenViking Integration**: Context database from Volcengine/ByteDance (15.3k stars) for enhanced memory/skills retrieval, addressing the Infinite Memory Vault vision.

## 🌎 Phase 5: Ecosystem Expansion

**Objective**: Scale beyond a single web application.

- [x] **Ohio Migration**: Move AWS EC2 nodes to `us-east-2` for sub-10ms DB latency.
- [ ] **Multi-Region Compute**: Scale bridge nodes to EU and Asia for global horizontal scaling.
- [ ] **Public API**: Allow third-party developers to rent Randi containers via API.
- [ ] **Progressive Web App (PWA)**: Mobile-optimized chat experience (Drafted via Telegram PWA).
- [ ] **Governance Interface**: Allow $RANDI holders to vote on new agent "Personalities" or "Tools."

## 🛡️ Phase 6: UX REWRITE & RUNTIME RESILIENCE (Completed)

**Objective**: Decouple the "Brain" from the "Provisioner" to ensure users are never blocked.

- [x] **IA Overhaul**: Primary entry renamed to "Ask Randi", specialized infra moved to "Agent Skills" and "Operator" sections.
- [x] **Async Provisioning**: Start chat immediately on shared runtime while dedicated containers spin up in background.
- [x] **Non-Blocking Badge**: UI indicator for runtime state (Starting/Active/Failed).
- [x] **Provisioner Abstraction**: Implement `/api/runtimes/provision` as a single boundary for all compute backends.

## 👑 Phase 7: The Sovereign Agent (Vision)

**Objective**: Transform from a chatbot to a fully autonomous, self-funded identity.

- [ ] **Self-Maintenance Loop**: Randi can inspect its own codebase, identify drift or improvement opportunities, and launch bounded remote coding sessions that return review-ready changes.
- [ ] **Autonomous Research (AutoResearch)**: Integrate [Karpathy's AutoResearch](https://github.com/karpathy/autoresearch) pattern—autonomous AI agents running experiments on LLM training with fixed time budgets, self-modifying code, and overnight experimentation cycles. Randi could research improvements to its own prompts, models, or strategies.
- [ ] **Autonomous Feature Execution**: Randi can turn roadmap items and maintenance requests into scoped implementation tasks with progress reporting, diff summaries, and branch-ready output.
- [ ] **Brand Growth Pack**: Autonomous X and Farcaster monitoring/engagement skills.
- [ ] **Infinite Memory Vault**: Persistent, personalized RAG storage for every user.
- [ ] **Agent Swarms**: Multi-agent orchestration (PM -> Developer -> Tester) for complex builds.
- [ ] **Commercial Autonomy**: Shopify and Stripe skills to let Randi manage storefronts and refunds.
- [ ] **Randi Minions**: "One-shot" end-to-end coding agents. [View Implementation Plan](file:///C:/Users/billy/.gemini/antigravity/brain/66f2185b-21de-4d7a-a758-907738220bed/implementation_plan.md)

---

_Note: This is a living document and will be updated as the Randi ecosystem evolves._
