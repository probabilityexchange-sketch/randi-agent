"use client";

import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { RandiLogo } from "@/components/branding/RandiLogo";
import { useAuth } from "@/hooks/useAuth";

export default function LandingPage() {
  const { user } = useAuth();
  const xUrl = process.env.NEXT_PUBLIC_X_URL || "https://x.com";
  const composioToolsUrl =
    process.env.NEXT_PUBLIC_COMPOSIO_TOOLS_URL || "https://composio.dev/tools";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-10 text-center">
        <div className="mb-6 flex justify-center animate-in fade-in zoom-in duration-500">
          <RandiLogo size="xl" variant="icon-only" className="drop-shadow-2xl" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <p className="text-sm text-muted-foreground">
            Powered by{" "}
            <a
              href={composioToolsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline font-bold"
            >
              Composio
            </a>{" "}
            &{" "}
            <a
              href="https://kilo.ai"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline font-bold"
            >
              Kilo Code
            </a>
          </p>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
          Intelligent AI Agents
          <br />
          <span className="text-primary">Powered by Randi</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
          Instant access to specialized AI agents with 1000+ tool integrations.
          Sign in once, chat everywhere. Free tier available for everyone.
        </p>

        <div className="flex flex-wrap gap-4 justify-center mb-16">
          {user ? (
            <Link
              href="/dashboard"
              className="px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold text-lg transition-all shadow-lg shadow-primary/20"
            >
              Go to Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold text-lg transition-all shadow-lg shadow-primary/20"
            >
              Get Started for Free
            </Link>
          )}
          <a
            href={xUrl}
            target="_blank"
            rel="noreferrer"
            className="px-8 py-3 border border-border hover:border-primary/40 bg-card hover:bg-card/80 text-foreground rounded-lg font-semibold text-lg transition-all"
          >
            Follow on X
          </a>
        </div>

        <div className="mb-16 text-center">
          <Link href="/demo" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            See How It Works →
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 text-left">
          <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-3.04l.533-.811a7.122 7.122 0 00-.657-1.496 6.505 6.505 0 01-1.45-6.355 6.505 6.505 0 019.592-2.983 6.505 6.505 0 001.384 1.06 6.505 6.505 0 014.285 5.91 6.505 6.505 0 00.413 2.053m-6.222 2.518V21m0 0h2.497m-2.497 0H12m0 0V21m0-10V5m0 0L9 8m3-3l3 3" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Social & Wallet Auth</h3>
            <p className="text-sm text-muted-foreground">
              Sign in with Google, Twitter, or your favorite wallet via Privy.
              Seamless onboarding without any complex setup.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Integrated Chat</h3>
            <p className="text-sm text-muted-foreground">
              Chat directly with agents specialized in research, coding, and productivity.
              Powered by Kilo Code for the best AI models.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Tool Integrations</h3>
            <p className="text-sm text-muted-foreground">
              Composio integration allows your agents to interact with GitHub, Slack,
              Gmail, and 1000+ other apps.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
