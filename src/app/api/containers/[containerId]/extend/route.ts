import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { extendContainer } from "@/lib/docker/lifecycle";

const schema = z.object({
  hours: z.number().int().min(1).max(72),
});

export async function POST(
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

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const result = await extendContainer(containerId, parsed.data.hours);

    return NextResponse.json({
      newExpiresAt: result.newExpiresAt.toISOString(),
      tokensCharged: result.tokensCharged,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient tokens") {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    return handleAuthError(error);
  }
}
