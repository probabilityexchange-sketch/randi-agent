import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { createPurchaseIntent } from "@/lib/payments/credits-ledger";

const schema = z.object({
  packageCode: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const intent = await createPurchaseIntent({
      prisma,
      userId: auth.userId,
      packageCode: parsed.data.packageCode,
    });

    return NextResponse.json({
      intentId: intent.id,
      expectedAmount: intent.expectedAmount.toString(),
      mint: intent.mint,
      treasury: intent.treasury,
      expiresAt: intent.expiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PACKAGE_NOT_FOUND") {
      return NextResponse.json({ error: "Package not found or disabled" }, { status: 404 });
    }
    return handleAuthError(error);
  }
}
