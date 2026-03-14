"use client";

import { useCallback, useEffect, useState } from "react";
import type { FleetStatsResponse, FleetNodeStats } from "@/types/fleet";
import { formatBytes } from "@/types/fleet";

export default function FleetPage() {
    const [stats, setStats] = useState<FleetStatsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch("/api/fleet/stats");
            if (res.ok) {
                setStats(await res.json());
                setError(null);
            } else {
                setError("Failed to fetch fleet stats");
            }
        } catch {
            setError("Failed to connect to fleet API");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchStats();
        const interval = setInterval(fetchStats, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [fetchStats]);

    if (loading) {
        return (
            <div className="max-w-6xl">
                <h1 className="text-2xl font-bold mb-6">Fleet Monitoring</h1>
                <div className="text-muted-foreground">Loading fleet stats...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-6xl">
                <h1 className="text-2xl font-bold mb-6">Fleet Monitoring</h1>
                <div className="bg-destructive/10 text-destructive rounded-lg p-4">{error}</div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="max-w-6xl">
                <h1 className="text-2xl font-bold mb-6">Fleet Monitoring</h1>
                <div className="text-muted-foreground">No fleet data available</div>
            </div>
        );
    }

    const memoryUsedPercent = stats.aggregate.totalMemoryLimit !== "0"
        ? (Number(stats.aggregate.totalMemoryUsed) / Number(stats.aggregate.totalMemoryLimit)) * 100
        : 0;

    return (
        <div className="max-w-6xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Fleet Monitoring</h1>
                <button
                    onClick={fetchStats}
                    className="px-3 py-1.5 bg-muted hover:bg-border rounded-lg text-sm transition-colors"
                >
                    Refresh
                </button>
            </div>

            {/* Aggregate Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Active Containers</p>
                    <p className="text-2xl font-bold">{stats.aggregate.totalContainers}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Active Nodes</p>
                    <p className="text-2xl font-bold">{stats.aggregate.nodes}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Avg CPU Usage</p>
                    <p className="text-2xl font-bold">{stats.aggregate.avgCpuPercent.toFixed(1)}%</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Memory Usage</p>
                    <p className="text-2xl font-bold">{memoryUsedPercent.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">
                        {formatBytes(stats.aggregate.totalMemoryUsed)} / {formatBytes(stats.aggregate.totalMemoryLimit)}
                    </p>
                </div>
            </div>

            {/* Network Stats */}
            <div className="bg-card border border-border rounded-xl p-4 mb-8">
                <h2 className="text-lg font-semibold mb-4">Network I/O</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Received</p>
                        <p className="text-xl font-semibold text-green-500">
                            ↓ {formatBytes(stats.aggregate.totalNetworkRx)}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Transmitted</p>
                        <p className="text-xl font-semibold text-blue-500">
                            ↑ {formatBytes(stats.aggregate.totalNetworkTx)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Node Details */}
            <h2 className="text-lg font-semibold mb-4">Nodes</h2>
            {stats.nodes.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground">
                    No active nodes reporting
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {stats.nodes.map((node) => (
                        <NodeCard key={node.nodeId} node={node} />
                    ))}
                </div>
            )}
        </div>
    );
}

function NodeCard({ node }: { node: FleetNodeStats }) {
    const memoryPercent = node.totalMemoryLimit !== "0"
        ? (Number(node.totalMemoryUsed) / Number(node.totalMemoryLimit)) * 100
        : 0;

    const lastReport = new Date(node.reportedAt);
    const reportAgo = Math.floor((Date.now() - lastReport.getTime()) / 1000);

    return (
        <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h3 className="font-medium">{node.nodeId}</h3>
                    <p className="text-sm text-muted-foreground">{node.nodeRegion}</p>
                </div>
                <span className={`w-2 h-2 rounded-full ${reportAgo < 60 ? "bg-green-500" : "bg-yellow-500"}`}></span>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Containers</span>
                    <span className="font-medium">{node.totalContainers}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CPU</span>
                    <span className="font-medium">{node.totalCpuPercent.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Memory</span>
                    <span className="font-medium">
                        {memoryPercent.toFixed(1)}% ({formatBytes(node.totalMemoryUsed)})
                    </span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Network</span>
                    <span className="font-medium">
                        ↓{formatBytes(node.totalNetworkRx)} ↑{formatBytes(node.totalNetworkTx)}
                    </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                    <span>Last report</span>
                    <span>
                        {reportAgo < 60
                            ? `${reportAgo}s ago`
                            : `${Math.floor(reportAgo / 60)}m ago`}
                    </span>
                </div>
            </div>
        </div>
    );
}
