"use client";

import Link from "next/link";

const featuredSkills = [
    {
        slug: "hummingbot",
        name: "Hummingbot Core",
        description: "Automated trading across 100+ exchanges. Market making, arbitrage, and portfolio management.",
        icon: "🤖"
    },
    {
        slug: "polymarket",
        name: "Polymarket",
        description: "Real-time prediction market analysis and execution. Bet on world events via the CLI.",
        icon: "🗳️"
    },
    {
        slug: "clawnch",
        name: "Clawnch",
        description: "The autonomous launchpad. Deploy tokens, manage liquidity, and coordinate launches.",
        icon: "🚀"
    },
    {
        slug: "react-expert",
        name: "React & UX",
        description: "Deep domain knowledge in modern web builds, design systems, and component architecture.",
        icon: "🎨"
    }
];

export const PaymentExplainer = () => {
    return (
        <div className="space-y-12">
            <section>
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                        <span className="text-2xl">⚡</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black italic tracking-tighter uppercase">The Three-Tier Economy</h2>
                        <p className="text-muted-foreground text-sm font-medium">How Randi routes value across internal credits, machine payments, and traditional rails.</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {/* Platform Tier */}
                    <div className="glass-card p-6 rounded-3xl border border-border/50 hover:border-primary/30 transition-all group">
                        <div className="text-[10px] font-black tracking-widest text-primary mb-2 uppercase italic">Tier 1: Native</div>
                        <h3 className="text-lg font-bold mb-3">$RANDI Credits</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                            The internal engine of the ecosystem. Used for LLM reasoning, container orchestration, and basic tasks.
                        </p>
                        <ul className="space-y-2 mb-6">
                            <li className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white">
                                <span className="w-1 h-1 rounded-full bg-primary"></span> Solana Settled
                            </li>
                            <li className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white">
                                <span className="w-1 h-1 rounded-full bg-primary"></span> Burn Mechanism
                            </li>
                        </ul>
                        <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Settlement</p>
                            <p className="text-[10px] font-mono text-primary truncate">On-Demand Token Ledger</p>
                        </div>
                    </div>

                    {/* Machine Tier */}
                    <div className="glass-card p-6 rounded-3xl border border-border/50 hover:border-primary/30 transition-all group">
                        <div className="text-[10px] font-black tracking-widest text-success mb-2 uppercase italic">Tier 2: M2M</div>
                        <h3 className="text-lg font-bold mb-3">x402 Protocol</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                            Direct machine-to-machine payments. Allows Randi to pay for infrastructure (like Alchemy) instantly using crypto.
                        </p>
                        <ul className="space-y-2 mb-6">
                            <li className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white">
                                <span className="w-1 h-1 rounded-full bg-success"></span> USDC on Base
                            </li>
                            <li className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white">
                                <span className="w-1 h-1 rounded-full bg-success"></span> SIWE Auth
                            </li>
                        </ul>
                        <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Settlement</p>
                            <p className="text-[10px] font-mono text-success truncate">402 Payment Required</p>
                        </div>
                    </div>

                    {/* Human Tier */}
                    <div className="glass-card p-6 rounded-3xl border border-border/50 hover:border-primary/30 transition-all group highlight-border">
                        <div className="text-[10px] font-black tracking-widest text-accent mb-2 uppercase italic">Tier 3: Fiat Web</div>
                        <h3 className="text-lg font-bold mb-3">AgentCard</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                            Autonomous spending at traditional stores. Randi generates virtual Visas to pay for domain names, SaaS, and more.
                        </p>
                        <ul className="space-y-2 mb-6">
                            <li className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white">
                                <span className="w-1 h-1 rounded-full bg-accent"></span> Virtual Visa
                            </li>
                            <li className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white">
                                <span className="w-1 h-1 rounded-full bg-accent"></span> Funded via Stripe
                            </li>
                        </ul>
                        <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Settlement</p>
                            <p className="text-[10px] font-mono text-accent truncate">Visa / Stripe Network</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="glass-card p-10 rounded-[2.5rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32"></div>
                <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-6">How Skills Plug In</h2>
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                    <span className="text-xs text-white">1</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm mb-1 uppercase tracking-wider">Knowledge Transfer</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Knowledge skills such as <b>React Expert</b> and <b>UX Design</b> shape planning quality. Randi reads these docs before execution.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                    <span className="text-xs text-white">2</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm mb-1 uppercase tracking-wider">Autonomous Tools</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Action skills such as <b>Clawnch</b> provide tool access. Randi can run scripts, deploy contracts, and execute workflows from chat.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                    <span className="text-xs text-primary font-black">3</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm mb-1 uppercase tracking-wider text-primary">Trading Core</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        With <b>Hummingbot</b> and <b>Polymarket</b>, Randi can reason about cross-exchange opportunities, prediction markets, and liquidity operations.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-black/60 border border-border/50 rounded-3xl p-6 backdrop-blur-xl">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Live Integration Log</span>
                        </div>
                        <div className="space-y-3 font-mono text-[9px]">
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-muted-foreground">RESOLVE: hummingbot-core</span>
                                <span className="text-success">[OK]</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-muted-foreground">SCAN: cross-exchange-opps</span>
                                <span className="text-primary font-bold">SCANNING</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-muted-foreground">ACTION: clawnch_launch_validate</span>
                                <span className="text-success">[OK]</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">PAYMENT: x402-settlement</span>
                                <span className="text-primary font-bold">READY</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase">Featured Skills</h2>
                    <Link href="/skills" className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-[10px] font-black text-primary tracking-widest uppercase transition-colors hover:bg-primary/10">
                        Browse All
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {featuredSkills.map(skill => (
                        <Link key={skill.slug} href={`/skills/${skill.slug}`} className="glass-card p-6 rounded-3xl border border-white/5 hover:border-primary/20 transition-all group">
                            <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">{skill.icon}</div>
                            <h4 className="font-bold text-sm mb-2 uppercase tracking-wider">{skill.name}</h4>
                            <p className="text-[10px] text-muted-foreground leading-relaxed mb-4">{skill.description}</p>
                            <div className="text-[9px] font-black text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Open Skill Guide →</div>
                        </Link>
                    ))}
                </div>
            </section>

            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 glass-card p-8 rounded-3xl border border-white/5">
                    <h3 className="text-sm font-black italic mb-4 uppercase tracking-widest">Self-Sustaining Logic</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Holders of the <b>$RANDI</b> token drive the deflationary feedback loop. Every credit spent on the platform contributes to the verified burn schedule, ensuring the more Randi works, the rarer the token becomes.
                    </p>
                </div>
                <div className="flex-1 glass-card p-8 rounded-3xl border border-white/5 text-center flex flex-col items-center justify-center">
                    <p className="text-xs text-muted-foreground font-medium mb-4 italic">Ready to see it in action?</p>
                    <div className="flex gap-4">
                        <Link href="/chat" className="px-6 py-2.5 bg-primary text-white text-xs font-black rounded-xl hover:translate-x-1 transition-transform">ASK RANDI</Link>
                        <Link href="/credits" className="px-6 py-2.5 bg-white text-black text-xs font-black rounded-xl hover:-translate-y-1 transition-transform">TOP UP</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
