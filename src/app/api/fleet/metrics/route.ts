import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/fleet/metrics
 * Returns historical fleet statistics for charting.
 * Optional query params:
 * - nodeId: Filter by specific node
 * - since: ISO timestamp to get stats after a certain time
 * - limit: Maximum number of data points to return (default: 100)
 */
export async function GET(req: NextRequest) {
  try {
    const nodeId = req.nextUrl.searchParams.get("nodeId");
    const since = req.nextUrl.searchParams.get("since");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam), 1000) : 100; // Cap at 1000

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

    // Get historical stats ordered by reportedAt asc for charting
    const stats = await prisma.fleetStats.findMany({
      where,
      orderBy: { reportedAt: "asc" },
      take: limit,
    });

    // Format response for frontend consumption
    const formattedStats = stats.map(stat => ({
      nodeId: stat.nodeId,
      nodeRegion: stat.nodeRegion,
      totalContainers: stat.totalContainers,
      totalCpuPercent: stat.totalCpuPercent,
      totalMemoryUsed: stat.totalMemoryUsed.toString(),
      totalMemoryLimit: stat.totalMemoryLimit.toString(),
      totalNetworkRx: stat.totalNetworkRx.toString(),
      totalNetworkTx: stat.totalNetworkTx.toString(),
      reportedAt: stat.reportedAt.toISOString(),
    }));

    return NextResponse.json({
      stats: formattedStats,
      count: formattedStats.length,
    });
  } catch (err) {
    console.error("Failed to fetch fleet metrics:", err);
    return NextResponse.json(
      { error: "Failed to fetch fleet metrics" },
      { status: 500 }
    );
  }
}
