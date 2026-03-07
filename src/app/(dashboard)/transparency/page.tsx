"use client";

import { useState, useEffect } from "react";
import { useTokenPrice } from "@/hooks/useTokenPrice";

interface BurnStat {
    date: string;
    tokenAmount: string;
    burnAmount: string;
    burnBps: number;
    status: "on_chain" | "accounted";
    explorerSignature: string | null;
}

interface BurnData {
    totalBurned: string; // Global chain-wide
    totalBurnedSource: "on_chain" | "accounted_fallback";
    platformBurned: string; // Internal system-specific
    totalVolume: string;
    history: BurnStat[];
}

const solanaNetwork = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta").toLowerCase();

function getSolscanTxUrl(signature: string): string {
    const cluster =
        solanaNetwork === "mainnet" || solanaNetwork === "mainnet-beta"
            ? ""
            : `?cluster=${encodeURIComponent(solanaNetwork)}`;

    return `https://solscan.io/tx/${signature}${cluster}`;
}

export default function TransparencyPage() {
    const { priceUsd, marketCap, formatRandi, formatUsdCompact, loading: priceLoading } = useTokenPrice();
    const [data, setData] = useState<BurnData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = () => {
            setLoading(true);
            fetch("/api/stats/burns")
                .then((res) => res.json())
                .then((json) => {
                    setData(json);
                    setLoading(false);
                })
                .catch((err) => {
                    console.error("Error fetching burn data:", err);
                    setLoading(false);
                });
        };

        fetchData();
        const interval = setInterval(fetchData, 30000); // 30s poll
        return () => clearInterval(interval);
    }, []);

    const formatTokens = (amount: string | bigint | undefined) => {
        if (!amount) return "0";
        const val = typeof amount === "string" ? BigInt(amount) : amount;
        // Assuming 9 decimals for RANDI based on previous code
        const base = Number(val) / 1e6;
        return formatRandi(base);
    };

    const formatUsd = (amount: string | bigint | undefined) => {
        if (!amount || !priceUsd) return "$0.00";
        const val = typeof amount === "string" ? BigInt(amount) : amount;
        const tokens = Number(val) / 1e6;
        const usd = tokens * priceUsd;
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(usd);
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Transparency Dashboard</h1>
                <p className="text-muted-foreground">Real-time monitoring of RANDI token burns and treasury flows.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Total Burned */}
                <div className="bg-card border border-orange-500/20 rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                        <svg className="w-12 h-12 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C12 2 12 7 9 7C6 7 6 10 6 12C6 15.31 8.69 18 12 18C15.31 18 18 15.31 18 12C18 7 12 2 12 2ZM14 15C13.45 15.55 12.74 15.86 12 15.89V14.5C12.44 14.47 12.83 14.28 13.12 14C12.8 13.79 12.42 13.66 12 13.66V12.16C12.74 12.19 13.45 12.5 14 13.06C14.56 13.62 14.87 14.33 14.87 15.07C14.87 15.05 14.87 15.02 14.87 15C14.87 15.37 14.79 15.72 14.65 16.04L14 15Z" />
                        </svg>
                    </div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                        {loading || data?.totalBurnedSource === "on_chain" ? "On-Chain Burned 🔥" : "Accounted Burn Estimate"}
                    </p>
                    <h3 className="text-2xl font-mono font-bold text-orange-400">
                        {loading ? "..." : formatTokens(data?.totalBurned)}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {loading ? "Calculating..." : formatUsd(data?.totalBurned)}
                    </p>
                    {!loading && data?.totalBurnedSource === "accounted_fallback" && (
                        <p className="mt-2 text-[10px] text-amber-400 uppercase tracking-wider">
                            Using ledger fallback until an on-chain burn balance is available.
                        </p>
                    )}
                </div>

                {/* Platform Revenue */}
                <div className="bg-card border border-primary/20 rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                        <svg className="w-12 h-12 text-primary" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 1.88 1.55 3.14 3.3 3.61V21h3v-2.14c1.89-.35 3.5-1.35 3.5-3.5 0-2.58-2.14-3.46-4.61-4.04l-.21-.06z" />
                        </svg>
                    </div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Platform Burn 🌪️</p>
                    <h3 className="text-2xl font-mono font-bold text-primary">
                        {loading ? "..." : formatTokens(data?.platformBurned)}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {loading ? "Calculating..." : formatUsd(data?.platformBurned)}
                    </p>
                </div>

                {/* Current Price */}
                <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden group">
                    <a
                        href="https://pump.fun/coin/FYAz1bPKJUFRwT4pzhUzdN3UqCN5ppXRL2pfto4zpump"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                            <svg className="w-12 h-12 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z" />
                            </svg>
                        </div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 group-hover:text-primary transition-colors">RANDI Market Cap 📈</p>
                        <h3 className="text-2xl font-mono font-bold">
                            {priceLoading ? "..." : formatUsdCompact(marketCap)}
                        </h3>
                        <p className="text-sm text-primary font-bold mt-1">
                            {priceLoading ? "..." : `Price: $${priceUsd?.toFixed(8)}`}
                        </p>
                    </a>
                </div>
            </div>

            {/* Burn History */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/30">
                    <h2 className="font-bold">Recent Proof of Burn</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="bg-muted/10 text-muted-foreground border-b border-border">
                                <th className="px-6 py-3 font-semibold">Date</th>
                                <th className="px-6 py-3 font-semibold text-right">Total Tokens</th>
                                <th className="px-6 py-3 font-semibold text-right text-orange-400">Burned 🔥</th>
                                <th className="px-6 py-3 font-semibold text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground animate-pulse">
                                        Loading historical burn data...
                                    </td>
                                </tr>
                            ) : data?.history.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                        No burn history recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                data?.history.map((item, i) => (
                                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4 text-xs">
                                            {new Date(item.date).toLocaleDateString("en-US", {
                                                month: "short", day: "numeric", year: "numeric",
                                                hour: "2-digit", minute: "2-digit"
                                            })}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-right">
                                            {formatTokens(item.tokenAmount)}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-right text-orange-400 font-bold">
                                            {formatTokens(item.burnAmount)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    item.status === "on_chain"
                                                        ? "bg-success/10 text-success"
                                                        : "bg-amber-500/10 text-amber-400"
                                                }`}>
                                                    {item.status === "on_chain" ? "ON-CHAIN" : "ACCOUNTED"}
                                                </span>
                                                {item.explorerSignature && (
                                                    <a
                                                        href={getSolscanTxUrl(item.explorerSignature)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] text-primary hover:underline"
                                                    >
                                                        View on Solscan
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-8 p-6 bg-muted/20 rounded-xl border border-dashed border-border text-center">
                <p className="text-sm text-muted-foreground">
                    Purchase and subscription flows can prove burn on-chain immediately. Usage fees are always accounted in the ledger,
                    and move on-chain once the batch burn service runs with a configured treasury signer.
                </p>
            </div>
        </div>
    );
}
