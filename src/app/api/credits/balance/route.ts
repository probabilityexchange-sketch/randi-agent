import { NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export async function GET() {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(`credits-balance:${auth.userId}`, RATE_LIMITS.general);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { tokenBalance: true, subscriptionStatus: true, subscriptionExpiresAt: true },
    });

    const transactions = (await prisma.tokenTransaction.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        txSignature: true,
        description: true,
        createdAt: true,
      },
    })).map(t => ({ ...t, createdAt: t.createdAt.toISOString() }));

    return NextResponse.json({
      balance: user?.tokenBalance || 0,
      subscriptionStatus: user?.subscriptionStatus || "none",
      subscriptionExpiresAt: user?.subscriptionExpiresAt?.toISOString() || null,
      transactions,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
