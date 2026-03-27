import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { verifyIntentPaymentOnChain } from "@/lib/payments/verification";
import { verifyAndCreditIntent } from "@/lib/payments/credits-ledger";

const schema = z.object({
  txSig: z.string().min(1, "Transaction signature required"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const result = await verifyAndCreditIntent(
      {
        prisma,
        verifyOnChain: async (verifyParams) => {
          await verifyIntentPaymentOnChain(verifyParams);
        },
      },
      {
        userId: auth.userId,
        intentId: id,
        txSig: parsed.data.txSig,
      },
    );

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { tokenBalance: true },
    });

    return NextResponse.json({
      status: result.status,
      creditsAdded: result.status === "confirmed" ? result.creditsAdded : 0,
      balance: user?.tokenBalance ?? 0,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (["INTENT_NOT_FOUND", "INTENT_EXPIRED"].includes(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.startsWith("INTENT_")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return handleAuthError(error);
  }
}
