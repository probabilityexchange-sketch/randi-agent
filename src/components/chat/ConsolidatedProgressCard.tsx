"use client";

export type SpecialistProgressStatus =
    | "loading"
    | "retrying"
    | "completed"
    | "partial"
    | "blocked"
    | "failed";

export interface SpecialistProgressItem {
    slug: string;
    role: string;
    task: string;
    status: SpecialistProgressStatus;
    output?: string;
}

interface ConsolidatedProgressCardProps {
    specialists: SpecialistProgressItem[];
    overallStatus: SpecialistProgressStatus;
}

const STATUS_CONFIG: Record<
    SpecialistProgressStatus,
    { label: string; borderColor: string; dotColor: string; textColor: string }
> = {
    loading: {
        label: "Running",
        borderColor: "border-white/20",
        dotColor: "bg-white/40",
        textColor: "text-white/40",
    },
    retrying: {
        label: "Retrying",
        borderColor: "border-[#8B5CF6]",
        dotColor: "bg-[#8B5CF6]",
        textColor: "text-[#8B5CF6]",
    },
    completed: {
        label: "Completed",
        borderColor: "border-[#10B981]",
        dotColor: "bg-[#10B981]",
        textColor: "text-[#10B981]",
    },
    partial: {
        label: "Partial",
        borderColor: "border-[#F59E0B]",
        dotColor: "bg-[#F59E0B]",
        textColor: "text-[#F59E0B]",
    },
    blocked: {
        label: "Blocked",
        borderColor: "border-[#F59E0B]",
        dotColor: "bg-[#F59E0B]",
        textColor: "text-[#F59E0B]",
    },
    failed: {
        label: "Failed",
        borderColor: "border-[#EF4444]",
        dotColor: "bg-[#EF4444]",
        textColor: "text-[#EF4444]",
    },
};

function StatusIcon({ status }: { status: SpecialistProgressStatus }) {
    if (status === "loading" || status === "retrying") {
        const color = status === "retrying" ? "text-[#8B5CF6]" : "text-white/40";
        return (
            <svg
                className={`w-3.5 h-3.5 ${color} animate-spin`}
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 000 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
            </svg>
        );
    }
    if (status === "completed") {
        return (
            <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
        );
    }
    if (status === "partial" || status === "blocked") {
        return (
            <svg className="w-3.5 h-3.5 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
        );
    }
    return (
        <svg className="w-3.5 h-3.5 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}

function SpecialistRow({ item }: { item: SpecialistProgressItem }) {
    const cfg = STATUS_CONFIG[item.status];
    const isLoading = item.status === "loading" || item.status === "retrying";

    return (
        <div
            className={`flex items-start gap-3 p-3 rounded-lg border bg-[#1E293B]/60 transition-colors ${cfg.borderColor}`}
            role="listitem"
            aria-busy={isLoading}
            aria-label={`${item.role}: ${cfg.label}`}
        >
            <div className="mt-0.5 flex-shrink-0">
                <StatusIcon status={item.status} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono uppercase tracking-wider text-white/50">
                        {item.role}
                    </span>
                    <span className={`text-[10px] font-mono uppercase tracking-widest ${cfg.textColor}`}>
                        {cfg.label}
                    </span>
                </div>
                <p className="text-xs text-white/70 truncate">{item.task}</p>
                {item.output && item.status !== "loading" && (
                    <p className="mt-1 text-xs text-white/40 line-clamp-2">{item.output}</p>
                )}
                {isLoading && (
                    <div className="mt-1.5 h-1 w-full rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full w-1/2 bg-white/20 rounded-full animate-[progress-slide_1.5s_ease-in-out_infinite]" />
                    </div>
                )}
            </div>
        </div>
    );
}

export function ConsolidatedProgressCard({ specialists, overallStatus }: ConsolidatedProgressCardProps) {
    const overallCfg = STATUS_CONFIG[overallStatus];
    const completedCount = specialists.filter(s => s.status === "completed").length;
    const totalCount = specialists.length;

    return (
        <div
            className={`rounded-xl border bg-[#0F172A] p-4 space-y-3 ${overallCfg.borderColor}`}
            role="region"
            aria-label="Parallel Specialists Progress"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${overallCfg.dotColor} ${overallStatus === "loading" ? "animate-pulse" : ""}`}
                        aria-hidden="true"
                    />
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                        Employee Fleet
                    </span>
                </div>
                <span className={`text-[10px] font-mono uppercase tracking-widest ${overallCfg.textColor}`}>
                    {completedCount}/{totalCount} done
                </span>
            </div>

            {/* Specialist rows */}
            <div className="space-y-2" role="list" aria-label="Specialist statuses">
                {specialists.map((item) => (
                    <SpecialistRow key={item.slug} item={item} />
                ))}
            </div>

            {/* Footer announcement for screen readers */}
            {overallStatus !== "loading" && overallStatus !== "retrying" && (
                <p className="sr-only" aria-live="polite" aria-atomic="true">
                    {overallStatus === "completed"
                        ? "All specialists completed successfully."
                        : overallStatus === "partial" || overallStatus === "blocked"
                        ? "Some specialists are blocked or partially complete."
                        : "One or more specialists failed."}
                </p>
            )}
            {overallStatus === "retrying" && (
                <p className="sr-only" aria-live="polite" aria-atomic="true">
                    Retrying failed specialists.
                </p>
            )}
        </div>
    );
}
