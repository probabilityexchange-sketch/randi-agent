import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/**
 * POST /api/containers/[containerId]/snapshot
 * Triggers a manual snapshot of the container's storage volume.
 * This notifies the bridge server to create and upload a snapshot.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { containerId } = await params;
    const body = await req.json();
    const { agentSlug } = body;

    if (!agentSlug) {
      return NextResponse.json({ error: "agentSlug is required" }, { status: 400 });
    }

    // Verify the container belongs to the user
    const container = await prisma.container.findFirst({
      where: {
        id: containerId,
        userId: auth.userId,
      },
    });

    if (!container) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    if (container.status !== "RUNNING") {
      return NextResponse.json(
        { error: "Container must be running to create a snapshot" },
        { status: 400 }
      );
    }

    // Get the bridge URL from environment
    const bridgeUrl = process.env.BRIDGE_URL;
    const bridgeApiKey = process.env.COMPUTE_BRIDGE_API_KEY;

    if (!bridgeUrl || !bridgeApiKey) {
      return NextResponse.json(
        { error: "Bridge not configured" },
        { status: 500 }
      );
    }

    // Trigger snapshot on the bridge
    const response = await fetch(`${bridgeUrl}/container/${container.dockerId}/snapshot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-api-key": bridgeApiKey,
      },
      body: JSON.stringify({
        userId: auth.userId,
        agentSlug,
        containerId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Bridge snapshot error:", error);
      return NextResponse.json(
        { error: "Failed to trigger snapshot" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Snapshot triggered" });
  } catch (err) {
    return handleAuthError(err);
  }
}
