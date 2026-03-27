"use client";

import { useCallback, useEffect, useState } from "react";
import type { FleetStatsResponse } from "@/types/fleet";
import { EmployeeFleetGrid, type FleetNode, type NodeHealthStatus } from "@/components/dashboard/EmployeeFleetGrid";

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
                <div className="text-muted-foreground font-mono animate-pulse">CONNECTING TO HUD...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-6xl">
                <h1 className="text-2xl font-bold mb-6">Fleet Monitoring</h1>
                <div className="bg-destructive/10 text-destructive rounded-lg p-4 border border-destructive/20 font-mono text-sm">
                    {error}
                </div>
            </div>
        );
    }

    const nodes: FleetNode[] = stats?.nodes.map(n => {
        const lastReport = new Date(n.reportedAt);
        const reportAgo = Math.floor((Date.now() - lastReport.getTime()) / 1000);
        
        let status: NodeHealthStatus = "healthy";
        if (reportAgo > 300) status = "offline"; // 5 minutes
        else if (reportAgo > 60) status = "degraded"; // 1 minute

        return {
            nodeId: n.nodeId,
            displayName: n.nodeRegion,
            totalContainers: n.totalContainers,
            maxContainers: 50, // Default max for display
            reportedAt: lastReport,
            status
        };
    }) || [];

    return (
        <div className="max-w-6xl space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Fleet Monitoring</h1>
                    <p className="text-sm text-muted-foreground font-mono mt-1 uppercase tracking-wider opacity-50">
                        Operational status of parallel specialist nodes
                    </p>
                </div>
            </div>

            <EmployeeFleetGrid 
                nodes={nodes} 
                onRefresh={fetchStats} 
            />

            {/* Historical context placeholder or secondary data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-xl p-6">
                    <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/30 mb-4">Network Activity</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-white/50">Total RX</span>
                            <span className="text-sm font-mono text-emerald-400">{(Number(stats?.aggregate.totalNetworkRx || 0) / (1024 * 1024)).toFixed(2)} MB</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-white/50">Total TX</span>
                            <span className="text-sm font-mono text-sky-400">{(Number(stats?.aggregate.totalNetworkTx || 0) / (1024 * 1024)).toFixed(2)} MB</span>
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-6">
                    <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/30 mb-4">Resource Aggregate</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-white/50">Avg CPU</span>
                            <span className="text-sm font-mono text-white/80">{stats?.aggregate.avgCpuPercent.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-white/50">Fleet Capacity</span>
                            <span className="text-sm font-mono text-white/80">{stats?.aggregate.totalContainers} / {nodes.length * 50}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
