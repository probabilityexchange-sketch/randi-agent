"use client";

import { useCredits } from "@/hooks/useCredits";
import { PurchaseForm } from "@/components/credits/PurchaseForm";
import { useTokenPrice } from "@/hooks/useTokenPrice";

const solanaNetwork = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta").toLowerCase();

function getSolscanTxUrl(signature: string): string {
  const cluster =
    solanaNetwork === "mainnet" || solanaNetwork === "mainnet-beta"
      ? ""
      : `?cluster=${encodeURIComponent(solanaNetwork)}`;

  return `https://solscan.io/tx/${signature}${cluster}`;
}

export default function CreditsPage() {
  const { subscription, isSubscribed, transactions, loading, error } = useCredits();
  const { priceUsd } = useTokenPrice();

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-4xl font-black italic">CREDITS</h1>
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground animate-pulse">
          Synchronizing ledger...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter">CREDITS</h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Fuel your autonomous agents with $RANDI credits.
          </p>
        </div>
        {priceUsd && (
          <a
            href="https://pump.fun/coin/FYAz1bPKJUFRwT4pzhUzdN3UqCN5ppXRL2pfto4zpump"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-bold hover:bg-primary hover:text-white transition-all"
          >
            $RANDI: ${priceUsd.toFixed(8)}
          </a>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 font-medium">
          {error}
        </div>
      )}

      {/* Subscription Status */}
      {isSubscribed && subscription.expiresAt && (
        <div className="bg-success/5 border border-success/30 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-success/20 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-2xl">✨</span>
          </div>
          <div>
            <p className="font-black text-success italic uppercase tracking-widest text-sm">Active Pro Subscription</p>
            <p className="text-xs text-muted-foreground font-bold mt-0.5">
              Renewal Date: {new Date(subscription.expiresAt).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
              })}
            </p>
          </div>
        </div>
      )}

      {/* Purchase Form */}
      <PurchaseForm />

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="bg-card/30 border border-border rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-4 border-b border-border bg-muted/20">
            <h2 className="font-black italic text-sm tracking-widest">TRANSACTION LOG</h2>
          </div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto no-scrollbar">
            {transactions.map((tx) => (
              <div key={tx.id} className="px-5 py-4 flex items-center justify-between group hover:bg-white/5 transition-colors">
                <div>
                  <p className="font-bold text-sm group-hover:text-primary transition-colors">{tx.description || tx.type}</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase mt-0.5">
                    {new Date(tx.createdAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black italic uppercase ${tx.status === "CONFIRMED"
                    ? "bg-success/20 text-success"
                    : tx.status === "PENDING"
                      ? "bg-warning/20 text-warning"
                      : "bg-red-500/20 text-red-400"
                    }`}>
                    {tx.status}
                  </span>
                  {tx.txSignature && (
                    <a
                      href={getSolscanTxUrl(tx.txSignature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex text-[9px] font-mono text-muted-foreground/60 transition-colors hover:text-primary"
                    >
                      {tx.txSignature.slice(0, 12)}...
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
