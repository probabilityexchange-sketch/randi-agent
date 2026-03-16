import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { z } from "zod";

const bigintField = z.union([z.number(), z.string()]).optional().default(0).transform(v => BigInt(v));

const fleetStatsSchema = z.object({
    nodeId: z.string().min(1),
    nodeRegion: z.string().min(1),
    totalContainers: z.number().int().min(0).default(0),
    totalCpuPercent: z.number().min(0).default(0),
    totalMemoryUsed: bigintField,
    totalMemoryLimit: bigintField,
    totalNetworkRx: bigintField,
    totalNetworkTx: bigintField,
});

/**
 * GET /api/fleet/stats
 * Returns the latest fleet statistics for monitoring dashboard.
 * Optional query params:
 * - nodeId: Filter by specific node
 * - since: ISO timestamp to get stats after a certain time
 */
export async function GET(req: NextRequest) {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const { allowed } = await checkRateLimit(`fleet-stats:${ip}`, RATE_LIMITS.general);
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const nodeId = req.nextUrl.searchParams.get("nodeId");
        const since = req.nextUrl.searchParams.get("since");

        const where: {
            nodeId?: string;
            reportedAt?: { gte: Date };
        } = {};

        if (nodeId) {
            where.nodeId = nodeId;
        }

        if (since) {
            where.reportedAt = { gte: new Date(since) };
        }

        // Get recent stats ordered by reportedAt desc, then deduplicate by nodeId
        const allStats = await prisma.fleetStats.findMany({
            where,
            orderBy: { reportedAt: "desc" },
            take: 100, // Get enough to cover all nodes
        });

        // Deduplicate: keep only the latest entry per nodeId
        const seenNodes = new Set<string>();
        const latestStats = allStats.filter((stat) => {
            if (seenNodes.has(stat.nodeId)) return false;
            seenNodes.add(stat.nodeId);
            return true;
        });

        // Calculate aggregate totals
        const aggregate = {
            totalContainers: 0,
            avgCpuPercent: 0,
            totalMemoryUsed: BigInt(0),
            totalMemoryLimit: BigInt(0),
            totalNetworkRx: BigInt(0),
            totalNetworkTx: BigInt(0),
            nodes: latestStats.length,
        };

        for (const stat of latestStats) {
            aggregate.totalContainers += stat.totalContainers;
            aggregate.avgCpuPercent += stat.totalCpuPercent;
            aggregate.totalMemoryUsed += stat.totalMemoryUsed;
            aggregate.totalMemoryLimit += stat.totalMemoryLimit;
            aggregate.totalNetworkRx += stat.totalNetworkRx;
            aggregate.totalNetworkTx += stat.totalNetworkTx;
        }

        if (latestStats.length > 0) {
            aggregate.avgCpuPercent /= latestStats.length;
        }

        return NextResponse.json({
            nodes: latestStats.map((s) => ({
                nodeId: s.nodeId,
                nodeRegion: s.nodeRegion,
                totalContainers: s.totalContainers,
                totalCpuPercent: s.totalCpuPercent,
                totalMemoryUsed: s.totalMemoryUsed.toString(),
                totalMemoryLimit: s.totalMemoryLimit.toString(),
                totalNetworkRx: s.totalNetworkRx.toString(),
                totalNetworkTx: s.totalNetworkTx.toString(),
                reportedAt: s.reportedAt.toISOString(),
            })),
            aggregate: {
                ...aggregate,
                totalMemoryUsed: aggregate.totalMemoryUsed.toString(),
                totalMemoryLimit: aggregate.totalMemoryLimit.toString(),
                totalNetworkRx: aggregate.totalNetworkRx.toString(),
                totalNetworkTx: aggregate.totalNetworkTx.toString(),
            },
        });
    } catch (err) {
        console.error("Failed to fetch fleet stats:", err);
        return NextResponse.json(
            { error: "Failed to fetch fleet stats" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/fleet/stats
 * Called by bridge servers to report their stats.
 * Requires x-bridge-api-key header for authentication.
 *
 * Body: {
 *   nodeId: string,
 *   nodeRegion: string,
 *   totalContainers: number,
 *   totalCpuPercent: number,
 *   totalMemoryUsed: bigint,
 *   totalMemoryLimit: bigint,
 *   totalNetworkRx: bigint,
 *   totalNetworkTx: bigint
 * }
 */
export async function POST(req: NextRequest) {
    const bridgeKey = req.headers.get("x-bridge-api-key");
    if (!bridgeKey || bridgeKey !== process.env.COMPUTE_BRIDGE_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const parsed = fleetStatsSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const stat = await prisma.fleetStats.create({
            data: {
                nodeId: parsed.data.nodeId,
                nodeRegion: parsed.data.nodeRegion,
                totalContainers: parsed.data.totalContainers,
                totalCpuPercent: parsed.data.totalCpuPercent,
                totalMemoryUsed: parsed.data.totalMemoryUsed,
                totalMemoryLimit: parsed.data.totalMemoryLimit,
                totalNetworkRx: parsed.data.totalNetworkRx,
                totalNetworkTx: parsed.data.totalNetworkTx,
            },
        });

        return NextResponse.json({ success: true, id: stat.id });
    } catch (err) {
        console.error("Failed to record fleet stats:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json(
            { error: "Failed to record fleet stats", detail: message },
            { status: 500 }
        );
    }
}
