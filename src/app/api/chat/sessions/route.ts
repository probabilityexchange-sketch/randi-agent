import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export async function GET() {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(`chat-sessions:${auth.userId}`, RATE_LIMITS.general);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const sessions = await prisma.chatSession.findMany({
      where: { userId: auth.userId },
      include: {
        agent: {
          select: { name: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    return handleAuthError(error);
  }
}
