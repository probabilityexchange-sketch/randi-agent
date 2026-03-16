import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(`chat-session:${auth.userId}`, RATE_LIMITS.general);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { sessionId } = await params;

    const { searchParams } = new URL(_req.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        agent: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!session || session.userId !== auth.userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      messages,
      agent: session.agent,
      nextCursor: messages.length === limit ? messages[messages.length - 1].id : null,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
