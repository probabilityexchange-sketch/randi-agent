import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getContainerLogs } from "@/lib/docker/lifecycle";

export async function GET(
  request: NextRequest,
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

    if (!container.dockerId) {
      return NextResponse.json({ error: "Container not provisioned" }, { status: 400 });
    }

    const tail = Number(request.nextUrl.searchParams.get("tail")) || 100;
    const logs = await getContainerLogs(container.dockerId, Math.min(tail, 500));

    return NextResponse.json({ logs });
  } catch (error) {
    return handleAuthError(error);
  }
}
