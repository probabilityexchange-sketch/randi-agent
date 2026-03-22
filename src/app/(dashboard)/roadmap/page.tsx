import fs from 'fs';
import path from 'path';
import React from 'react';

/** Render inline markdown: **bold**, `code`, and plain text. */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    if (match[1]) {
      nodes.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {match[1]}
        </strong>
      );
    } else if (match[2]) {
      nodes.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
          {match[2]}
        </code>
      );
    }
    last = re.lastIndex;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes;
}

/** Strip emoji prefix from a section header. */
function stripEmoji(text: string): string {
  return text.replace(/^[\p{Emoji}\p{Emoji_Presentation}\u200d\uFE0F]+\s*/u, '').trim();
}

export default async function RoadmapPage() {
  const rawContent = `# 🚀 Randi Agent Platform: Roadmap to randi.chat

This roadmap outlines the strategic phases for evolving the Randi Agent Platform from a functional MVP to a high-scale, distributed AI ecosystem.

## 📍 Phase 1: Launch Foundations (Current Focus)

**Objective**: Stabilize the user experience and secure the primary domain.

- [x] **Universal Auth**: Social + Wallet login via Privy.
- [x] **Web Performance**: Next.js 16 + Turbopack optimization.
- [x] **Transparency Hub**: Real-time token burn and platform stats dashboard.
- [x] **Vercel/Supabase Migration**: Cloud-native hosting with localized Ohio latency tuning.
- [x] **Custom Domain**: Launch \`randi.chat\` with Cloudflare SSL.
- [x] **Credits 1.0**: Finalize internal credit purchasing and balance tracking.
- [x] **UX & Runtime Resilience**: Decouple chat from provisioning to ensure zero-block user experience.
- [x] **Platform Explainer**: Launch the "How it Works" hub with the Three-Tier Economy breakdown (\$RANDI, x402, AgentCard).

## 🏗️ Phase 2: The "Body" (Compute Layer)

**Objective**: Connect the Vercel "Brain" to the AWS "Body" for code execution.

- [x] **Secure Docker Bridge**: Implement a secure API gateway between Vercel and AWS EC2. (Deployed in **us-east-2 Ohio** for minimum latency).
- [x] **Remote Compute Bridge v1.0**: Express-based bridge on EC2 receiving \`/spawn-ao\` commands with API key protection.
- [x] **Autonomous AO Sessions**: Integrated Composio Agent Orchestrator (\`ao\`) for repository-level coding tasks on EC2.
- [x] **Ephemeral Sandboxing**: Automated lifecycle management for user containers (Auto-start/Auto-stop).
- [x] **Persistent Storage**: S3/Supabase Storage integration for agent-generated files. (Supabase snapshot upload/restore implemented via bridge snapshots).
- [x] **Fleet Monitoring**: Real-time dashboard for tracking CPU/RAM/Traffic across all bridge nodes.

## 💰 Phase 3: Financial & Tokenomics Layer

**Objective**: Integrate the \$RANDI token deeply into the platform's DNA.

- [x] **On-Chain Verification**: Robust Solana transaction scanning for credit top-ups.
- [x] **x402 Protocol Integration**: Initial implementation of the x402 payment standard for premium AI model access.
- [x] **Automated Burn Mechanics**: Real-time \$RANDI burning on credit deposits (70% burn).
- [x] **Passive Staking Yield**: Stakers earn up to 200,000 daily platform credits.
- [x] **Credit Subscriptions**: Monthly \$RANDI credit subscriptions for power users.
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
- [x] **Human-in-the-loop**: Approval UI for sensitive agent actions with \`ToolApproval\` persistence.
- [x] **Trading & Data Expansion**: Integrated OpenWeather (Real-time data), Hummingbot (CEX/DEX Trading Core), and Polymarket (Prediction Markets).
- [ ] **OpenViking Integration**: Context database from Volcengine/ByteDance (15.3k stars) for enhanced memory/skills retrieval, addressing the Infinite Memory Vault vision.

## 🌎 Phase 5: Ecosystem Expansion

**Objective**: Scale beyond a single web application.

- [x] **Ohio Migration**: Move AWS EC2 nodes to \`us-east-2\` for sub-10ms DB latency.
- [ ] **Multi-Region Compute**: Scale bridge nodes to EU and Asia for global horizontal scaling.
- [ ] **Public API**: Allow third-party developers to rent Randi containers via API.
- [ ] **Progressive Web App (PWA)**: Mobile-optimized chat experience (Drafted via Telegram PWA).
- [ ] **Governance Interface**: Allow \$RANDI holders to vote on new agent "Personalities" or "Tools."

## 🛡️ Phase 6: UX REWRITE & RUNTIME RESILIENCE (Completed)

**Objective**: Decouple the "Brain" from the "Provisioner" to ensure users are never blocked.

- [x] **IA Overhaul**: Primary entry renamed to "Ask Randi", specialized infra moved to "Agent Skills" and "Operator" sections.
- [x] **Async Provisioning**: Start chat immediately on shared runtime while dedicated containers spin up in background.
- [x] **Non-Blocking Badge**: UI indicator for runtime state (Starting/Active/Failed).
- [x] **Provisioner Abstraction**: Implement \`/api/runtimes/provision\` as a single boundary for all compute backends.

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
`;

  let roadmapContent = rawContent.trim();

  const allLines = roadmapContent.split('\n');
  const title = stripEmoji(allLines[0].replace(/^#\s+/, ''));

  // Extract intro (lines between title and first ## section)
  const firstSectionIdx = allLines.findIndex((l, i) => i > 0 && l.startsWith('## '));
  const intro = allLines
    .slice(1, firstSectionIdx > 0 ? firstSectionIdx : undefined)
    .join(' ')
    .trim();

  // Split into ## sections
  const sections = roadmapContent
    .split(/^## /m)
    .slice(1)
    .filter(s => s.trim() !== '');

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
          {title}
        </h1>
        {intro && (
          <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {renderInline(intro)}
          </p>
        )}
      </div>

      <div className="space-y-8">
        {sections.map((section, idx) => {
          const lines = section.split('\n');
          const rawHeader = lines[0].trim();
          const header = stripEmoji(rawHeader);
          const bodyLines = lines.slice(1);

          const objectiveMatch = bodyLines.join('\n').match(/\*\*Objective\*\*:\s*(.*)/);
          const objective = objectiveMatch ? objectiveMatch[1] : null;

          const contentLines = bodyLines.filter(
            l => l.trim() !== '' && !l.includes('**Objective**:') && !l.startsWith('---')
          );

          return (
            <div
              key={idx}
              className="relative pl-8 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border group"
            >
              <div className="absolute left-[-4px] top-2 w-2 h-2 rounded-full bg-primary border border-background shadow-[0_0_8px_rgba(109,40,217,0.5)]" />

              <div className="bg-card/50 border border-border rounded-xl p-6 transition_all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="text-primary/70 font-mono text-sm">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  {header}
                </h2>

                {objective && (
                  <div className="mb-4 inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
                    {renderInline(objective)}
                  </div>
                )}

                <div className="space-y-3">
                  {contentLines.map((line, lIdx) => {
                    const trimmed = line.trim();
                    const isTask = trimmed.startsWith('- [');
                    const isChecked = trimmed.includes('- [x]');

                    if (isTask) {
                      const label = trimmed.replace(/^- \[[x ]\]\s*/, '').trim();
                      return (
                        <div key={lIdx} className="flex items-start gap-3 text-sm">
                          <div
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              isChecked
                                ? 'bg-success border-success text-white'
                                : 'border-border bg-muted/30'
                            }`}
                          >
                            {isChecked && (
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <span
                            className={
                              isChecked
                                ? 'text-muted-foreground line-through decoration-muted-foreground/50'
                                : 'text-foreground'
                            }
                          >
                            {renderInline(label)}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <p key={lIdx} className="text-sm text-muted-foreground">
                        {renderInline(trimmed)}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-16 text-center text-xs text-muted-foreground border-t border-border pt-8">
        This roadmap is a living document and will be updated as the Randi ecosystem evolves.
      </div>
    </div>
  );
}
