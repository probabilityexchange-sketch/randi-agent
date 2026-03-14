import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getComputeBridge } from "@/lib/compute/bridge-client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { containerId } = await params;

    // Verify this container belongs to the authenticated user
    const container = await prisma.container.findFirst({
      where: { id: containerId, userId: auth.userId },
    });

    if (!container) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    if (!container.dockerId) {
      return NextResponse.json(
        { error: "Container has no Docker ID" },
        { status: 400 }
      );
    }

    const bridge = getComputeBridge();
    if (!bridge) {
      return NextResponse.json(
        { error: "Compute bridge not configured" },
        { status: 503 }
      );
    }

    const stats = await bridge.getStats(container.dockerId);
    return NextResponse.json(stats);
  } catch (err) {
    return handleAuthError(err);
  }
}
