"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCredits } from "@/hooks/useCredits";
import { useTokenPrice } from "@/hooks/useTokenPrice";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/chat", label: "Ask Randi", icon: "message" },
  { href: "/how-it-works", label: "How it Works", icon: "help" },
  { href: "/skills", label: "Skills Library", icon: "cpu" },
  { href: "/integrations", label: "Integrations", icon: "link" },
  { href: "/credits", label: "Tokens", icon: "coins" },
];

const advancedNavItems = [
  { href: "/containers", label: "Containers", icon: "box" },
  { href: "/fleet", label: "Fleet", icon: "server" },
  { href: "/telegram", label: "Telegram Bot", icon: "message" },
  { href: "/transparency", label: "Transparency", icon: "shield" },
  { href: "/roadmap", label: "Roadmap", icon: "map" },
];

const icons: Record<string, string> = {
  grid: "M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z",
  cpu: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z",
  message: "M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  link: "M13.828 10.172a4 4 0 000 5.656l.586.586a4 4 0 005.656-5.656l-1.172-1.172a4 4 0 00-5.656 0M10.172 13.828a4 4 0 000-5.656l-.586-.586a4 4 0 10-5.656 5.656l1.172 1.172a4 4 0 005.656 0",
  help: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  coins: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  map: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  box: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  server: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01",
};

import { BurnCounter } from "./BurnCounter";

export function Sidebar() {
  const pathname = usePathname();
  const { isSubscribed, balance } = useCredits();
  const { priceUsd } = useTokenPrice();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [skills, setSkills] = useState<any[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/skills")
      .then((res) => res.json())
      .then((data) => setSkills(data.skills || []))
      .catch(() => { })
      .finally(() => setSkillsLoading(false));
  }, []);

  const renderNavItem = (item: { href: string; label: string; icon: string }) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d={icons[item.icon]}
          />
        </svg>
        {item.label}
        {item.icon === "coins" && isSubscribed && (
          <span className="ml-auto text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full">PRO</span>
        )}
      </Link>
    );
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="mb-6 px-3">
        <BurnCounter />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
        <nav className="space-y-1">
          {mainNavItems.map(renderNavItem)}
        </nav>

        <div>
          <h3 className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 opacity-50">
            Invokable Skills
          </h3>
          <div className="space-y-1 max-h-[30vh] overflow-y-auto no-scrollbar">
            {skillsLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-8 mx-3 bg-muted animate-pulse rounded-md mb-1"></div>
              ))
            ) : skills.length > 0 ? (
              skills.map((skill) => (
                <Link
                  key={skill.slug}
                  href={`/skills/${skill.slug}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary"></span>
                  {skill.name.split("-").map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
                </Link>
              ))
            ) : (
              <p className="px-3 text-[10px] text-muted-foreground italic">No skills found</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 opacity-50">
            Operator / Advanced
          </h3>
          <nav className="space-y-1">
            {advancedNavItems.map(renderNavItem)}
          </nav>
        </div>
      </div>

      <div className="border-t border-border pt-4 mt-4 space-y-3">
        {/* Subscription Status */}
        <div className="px-3 py-2 bg-muted/50 rounded-lg">
          {isSubscribed ? (
            <>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Status</p>
              <p className="text-sm font-bold text-success">Randi Pro Active</p>
            </>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Status</p>
              <p className="text-sm font-semibold text-muted-foreground">Free Tier</p>
              <Link href="/credits" className="text-xs text-primary hover:underline mt-1 inline-block">
                Upgrade →
              </Link>
            </>
          )}
        </div>
        {/* Token Balance */}
        <div className="px-3 py-2 bg-muted/50 rounded-lg">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">On-Demand Tokens</p>
          <p className="text-sm font-bold text-primary">{balance.toLocaleString()} TK</p>
        </div>
        {/* RANDI Price */}
        {priceUsd !== null && (
          <div className="px-3 py-2 bg-muted/50 rounded-lg">
            <a
              href="https://pump.fun/coin/FYAz1bPKJUFRwT4pzhUzdN3UqCN5ppXRL2pfto4zpump"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 hover:text-primary transition-colors">RANDI Price ↗</p>
              <p className="text-sm font-mono font-bold">${priceUsd.toFixed(8)}</p>
            </a>
          </div>
        )}
      </div>
    </div >
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed bottom-4 right-4 z-50 w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 text-white"
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border p-4 flex flex-col transform transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}>
        {sidebar}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border bg-card min-h-[calc(100vh-3.5rem)] p-4 flex-col">
        {sidebar}
      </aside>
    </>
  );
}
