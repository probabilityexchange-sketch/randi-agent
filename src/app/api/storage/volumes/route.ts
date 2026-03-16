import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

/**
 * GET /api/storage/volumes
 * Returns all storage volumes for the authenticated user with total size.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(`storage-volumes:${auth.userId}`, RATE_LIMITS.general);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const storageVolumes = await prisma.storageVolume.findMany({
      where: { userId: auth.userId },
      orderBy: { updatedAt: "desc" },
    });

    // Calculate total size
    const totalSize = storageVolumes.reduce((sum, vol) => {
      const size = vol.sizeBytes ?? BigInt(0);
      return sum + size;
    }, BigInt(0));

    return NextResponse.json({
      storageVolumes: storageVolumes.map(vol => ({
        id: vol.id,
        userId: vol.userId,
        agentSlug: vol.agentSlug,
        storageKey: vol.storageKey,
        sizeBytes: vol.sizeBytes?.toString() ?? null,
        snapshotPath: vol.snapshotPath,
        lastSyncAt: vol.lastSyncAt,
        createdAt: vol.createdAt,
      })),
      totalSizeBytes: totalSize.toString(),
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
