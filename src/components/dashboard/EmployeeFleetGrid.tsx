"use client";

export type NodeHealthStatus = "healthy" | "degraded" | "offline";

export interface FleetNode {
    nodeId: string;
    displayName?: string;
    totalContainers: number;
    maxContainers?: number;
    reportedAt: Date;
    status: NodeHealthStatus;
}

interface EmployeeFleetGridProps {
    nodes: FleetNode[];
    onRefresh?: () => void;
}

const HEALTH_CONFIG: Record<
    NodeHealthStatus,
    { label: string; borderColor: string; dotColor: string; textColor: string; bgColor: string }
> = {
    healthy: {
        label: "Healthy",
        borderColor: "border-[#10B981]/40",
        dotColor: "bg-[#10B981]",
        textColor: "text-[#10B981]",
        bgColor: "bg-[#10B981]/10",
    },
    degraded: {
        label: "Degraded",
        borderColor: "border-[#F59E0B]/40",
        dotColor: "bg-[#F59E0B]",
        textColor: "text-[#F59E0B]",
        bgColor: "bg-[#F59E0B]/10",
    },
    offline: {
        label: "Offline",
        borderColor: "border-[#EF4444]/40",
        dotColor: "bg-[#EF4444]",
        textColor: "text-[#EF4444]",
        bgColor: "bg-[#EF4444]/10",
    },
};

function formatRelativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return `${Math.floor(diffMin / 60)}h ago`;
}

function ContainerBar({ current, max }: { current: number; max: number }) {
    const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
    const barColor =
        pct >= 90 ? "bg-[#EF4444]" : pct >= 70 ? "bg-[#F59E0B]" : "bg-[#10B981]";

    return (
        <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">Containers</span>
                <span className="text-[10px] font-mono text-white/50">
                    {current}{max > 0 ? `/${max}` : ""}
                </span>
            </div>
            {max > 0 && (
                <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${pct}%` }}
                        role="progressbar"
                        aria-valuenow={current}
                        aria-valuemin={0}
                        aria-valuemax={max}
                        aria-label={`${current} of ${max} containers`}
                    />
                </div>
            )}
        </div>
    );
}

function NodeCard({ node }: { node: FleetNode }) {
    const cfg = HEALTH_CONFIG[node.status];
    const shortId = node.displayName || node.nodeId.replace(/^https?:\/\//, "").split(".")[0];

    return (
        <div
            className={`rounded-xl border ${cfg.borderColor} bg-[#1E293B] p-4 space-y-3 transition-colors`}
            role="article"
            aria-label={`Node ${shortId}: ${cfg.label}`}
        >
            {/* Node header */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dotColor} ${node.status === "healthy" ? "animate-pulse" : ""}`}
                            aria-hidden="true"
                        />
                        <span className="text-xs font-mono font-semibold text-white/80 truncate">
                            {shortId}
                        </span>
                    </div>
                    <span className="text-[10px] font-mono text-white/30 truncate block">
                        {node.nodeId}
                    </span>
                </div>
                <span
                    className={`flex-shrink-0 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-sm ${cfg.bgColor} ${cfg.textColor}`}
                >
                    {cfg.label}
                </span>
            </div>

            {/* Container load bar */}
            <ContainerBar
                current={node.totalContainers}
                max={node.maxContainers ?? 0}
            />

            {/* Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-[10px] font-mono text-white/25 uppercase tracking-wider">
                    Last seen
                </span>
                <span className="text-[10px] font-mono text-white/40">
                    {formatRelativeTime(node.reportedAt)}
                </span>
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
            </div>
            <p className="text-sm font-mono text-white/30 uppercase tracking-wider">No Active Employees</p>
            <p className="text-xs text-white/20 mt-1 max-w-xs">
                Nodes will appear here once they report in to the fleet registry.
            </p>
        </div>
    );
}

export function EmployeeFleetGrid({ nodes, onRefresh }: EmployeeFleetGridProps) {
    const healthyCnt = nodes.filter(n => n.status === "healthy").length;
    const totalContainers = nodes.reduce((sum, n) => sum + n.totalContainers, 0);

    return (
        <div className="space-y-4">
            {/* Fleet summary bar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div>
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">Fleet</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-lg font-semibold font-mono text-white/80">{nodes.length}</span>
                            <span className="text-xs text-white/30 font-mono">nodes</span>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-white/10" aria-hidden="true" />
                    <div>
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#10B981]/60">Online</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-lg font-semibold font-mono text-[#10B981]">{healthyCnt}</span>
                            <span className="text-xs text-white/30 font-mono">healthy</span>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-white/10" aria-hidden="true" />
                    <div>
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">Load</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-lg font-semibold font-mono text-white/80">{totalContainers}</span>
                            <span className="text-xs text-white/30 font-mono">containers</span>
                        </div>
                    </div>
                </div>

                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-xs font-mono text-white/40 hover:text-white/70 min-h-[44px]"
                        aria-label="Refresh fleet status"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                )}
            </div>

            {/* Node grid */}
            <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                role="list"
                aria-label="Fleet nodes"
            >
                {nodes.length === 0 ? (
                    <EmptyState />
                ) : (
                    nodes.map(node => (
                        <NodeCard key={node.nodeId} node={node} />
                    ))
                )}
            </div>
        </div>
    );
}
