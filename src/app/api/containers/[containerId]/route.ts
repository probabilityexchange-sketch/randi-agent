import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { stopContainer } from "@/lib/docker/lifecycle";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { containerId } = await params;

    const container = await prisma.container.findUnique({
      where: { id: containerId },
      include: { agent: { select: { name: true, slug: true, tokensPerHour: true } } },
    });

    if (!container || container.userId !== auth.userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: container.id,
      dockerId: container.dockerId,
      subdomain: container.subdomain,
      agentId: container.agentId,
      agentName: container.agent.name,
      status: container.status,
      url: container.url,
      password: container.password,
      tokensUsed: container.tokensUsed,
      expiresAt: container.expiresAt.toISOString(),
      createdAt: container.createdAt.toISOString(),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { containerId } = await params;

    const container = await prisma.container.findUnique({
      where: { id: containerId },
    });

    if (!container || container.userId !== auth.userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (container.status !== "RUNNING") {
      return NextResponse.json(
        { error: "Container is not running" },
        { status: 400 }
      );
    }

    await stopContainer(containerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
