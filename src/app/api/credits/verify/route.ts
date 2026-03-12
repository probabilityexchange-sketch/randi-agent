import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import {
  verifyNativeSolTransaction,
  verifyTransaction,
} from "@/lib/solana/tx-verification";
import { prisma } from "@/lib/db/prisma";
import {
  parseBurnBpsFromMemo,
  resolvePaymentAsset,
  resolveSolBurnWallet,
  splitTokenAmountsByBurn,
} from "@/lib/payments/token-pricing";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

const schema = z.object({
  transactionId: z.string().min(1, "Transaction id required"),
  txSignature: z.string().min(1, "Transaction signature required"),
  memo: z.string().min(1, "Memo required"),
});

function isRetryableVerificationFailure(error: string | undefined): boolean {
  if (!error) return true;
  const normalized = error.toLowerCase();
  return normalized.includes("transaction not found") || normalized.startsWith("verification failed:");
}

const DEFAULT_PURCHASE_INTENT_TTL_MS = 15 * 60 * 1000;
const MAX_PURCHASE_INTENT_TTL_MS = 24 * 60 * 60 * 1000;

function resolvePurchaseIntentTtlMs(): number {
  const raw = Number(process.env.PURCHASE_INTENT_TTL_MS || DEFAULT_PURCHASE_INTENT_TTL_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_PURCHASE_INTENT_TTL_MS;
  return Math.min(Math.trunc(raw), MAX_PURCHASE_INTENT_TTL_MS);
}

function parseIntentCreatedAtMs(memo: string): number | null {
  const match = memo.match(/^ap:(?:purchase|subscribe):(\d{10,13}):/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.trunc(value);
}

async function getUserBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenBalance: true },
  });
  return user?.tokenBalance || 0;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(
      `purchase-verify:${auth.userId}`,
      RATE_LIMITS.purchaseVerify
    );
    if (!allowed) {
      return NextResponse.json({ error: "Too many verification attempts" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { transactionId, txSignature, memo } = parsed.data;

    // Check for replay / idempotent replay by tx signature.
    const existing = await prisma.tokenTransaction.findUnique({
      where: { txSignature },
      select: {
        userId: true,
        status: true,
        memo: true,
      },
    });
    if (existing) {
      if (
        existing.userId === auth.userId &&
        existing.status === "CONFIRMED" &&
        existing.memo === memo
      ) {
        return NextResponse.json({
          success: true,
          tokensAdded: 0,
          newBalance: await getUserBalance(auth.userId),
          idempotent: true,
        });
      }
      return NextResponse.json(
        { error: "Transaction already processed" },
        { status: 409 }
      );
    }

    const intent = await prisma.tokenTransaction.findFirst({
      where: {
        id: transactionId,
        userId: auth.userId,
        memo,
        type: { in: ["PURCHASE", "SUBSCRIBE"] },
      },
      select: {
        id: true,
        status: true,
        txSignature: true,
        amount: true,
        tokenAmount: true,
        memo: true,
      },
    });

    if (!intent) {
      return NextResponse.json(
        { error: "No purchase intent found for this transaction" },
        { status: 404 }
      );
    }

    if (intent.status === "CONFIRMED") {
      if (intent.txSignature === txSignature) {
        return NextResponse.json({
          success: true,
          tokensAdded: 0,
          newBalance: await getUserBalance(auth.userId),
          idempotent: true,
        });
      }
      return NextResponse.json(
        { error: "Purchase intent already confirmed with a different transaction" },
        { status: 409 }
      );
    }

    if (intent.status !== "PENDING") {
      return NextResponse.json(
        { error: `Purchase intent is not pending (status: ${intent.status})` },
        { status: 409 }
      );
    }

    const intentCreatedAtMs = parseIntentCreatedAtMs(intent.memo || memo);
    const intentAgeMs = intentCreatedAtMs ? Date.now() - intentCreatedAtMs : null;
    if (intentAgeMs !== null && intentAgeMs > resolvePurchaseIntentTtlMs()) {
      await prisma.tokenTransaction.updateMany({
        where: { id: intent.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "Purchase intent has expired. Please create a new purchase." },
        { status: 410 }
      );
    }

    if (!intent.tokenAmount) {
      await prisma.tokenTransaction.updateMany({
        where: { id: intent.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { error: "Pending purchase is missing token amount" },
        { status: 500 }
      );
    }
    const expectedTokenAmount = intent.tokenAmount;

    const burnBps = parseBurnBpsFromMemo(intent.memo || memo);
    const split = splitTokenAmountsByBurn(expectedTokenAmount, burnBps);
    const paymentAsset = resolvePaymentAsset();

    // FIX (HIGH): Removed hardcoded treasury wallet fallback.
    // The application must fail loudly if TREASURY_WALLET is not configured.
    const treasuryWallet = process.env.TREASURY_WALLET;
    if (!treasuryWallet) {
      console.error("CRITICAL: TREASURY_WALLET environment variable is not set.");
      return NextResponse.json(
        { error: "Payment verification is not available: treasury wallet is not configured." },
        { status: 500 }
      );
    }

    const result =
      paymentAsset === "sol"
        ? await verifyNativeSolTransaction({
          txSignature,
          expectedRecipient: treasuryWallet,
          expectedTreasuryAmountLamports: split.treasuryTokenAmount,
          expectedMemo: memo,
          expectedBurnAmountLamports: split.burnTokenAmount,
          expectedBurnRecipient: resolveSolBurnWallet(),
          expectedSender: auth.wallet,
        })
        : await verifyTransaction(
          txSignature,
          (process.env.TOKEN_MINT || process.env.NEXT_PUBLIC_TOKEN_MINT)!,
          treasuryWallet,
          split.treasuryTokenAmount,
          memo,
          split.burnTokenAmount,
          auth.wallet
        );

    if (!result.valid) {
      return NextResponse.json(
        { error: result.error || "Verification failed" },
        { status: result.retryable || isRetryableVerificationFailure(result.error) ? 503 : 400 }
      );
    }

    let newBalance = 0;
    let tokensAdded = 0;
    let idempotent = false;

    try {
      await prisma.$transaction(async (tx) => {
        const claimResult = await tx.tokenTransaction.updateMany({
          where: {
            id: intent.id,
            userId: auth.userId,
            memo,
            status: "PENDING",
            txSignature: null,
          },
          data: {
            status: "CONFIRMED",
            txSignature,
            tokenAmount: expectedTokenAmount,
          },
        });

        if (claimResult.count === 0) {
          const existingIntent = await tx.tokenTransaction.findUnique({
            where: { id: intent.id },
            select: { status: true, txSignature: true },
          });
          if (
            existingIntent?.status === "CONFIRMED" &&
            existingIntent.txSignature === txSignature
          ) {
            idempotent = true;
            const user = await tx.user.findUnique({
              where: { id: auth.userId },
              select: { tokenBalance: true },
            });
            newBalance = user?.tokenBalance || 0;
            tokensAdded = 0;
            return;
          }
          throw new Error("Purchase intent is no longer pending");
        }

        const isSubscription = memo.includes(":subscribe:");

        if (isSubscription) {
          // Activate 30-day subscription
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const user = await tx.user.update({
            where: { id: auth.userId },
            data: {
              subscriptionStatus: "active",
              subscriptionExpiresAt: expiresAt,
              tier: "PRO",
            },
            select: { tokenBalance: true, subscriptionStatus: true, subscriptionExpiresAt: true },
          });
          newBalance = user.tokenBalance;
          tokensAdded = 0;
        } else {
          const user = await tx.user.update({
            where: { id: auth.userId },
            data: { tokenBalance: { increment: intent.amount } },
            select: { tokenBalance: true },
          });
          newBalance = user.tokenBalance;
          tokensAdded = intent.amount;
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Transaction already used by another purchase" },
          { status: 409 }
        );
      }
      if (error instanceof Error && error.message === "Purchase intent is no longer pending") {
        return NextResponse.json(
          { error: "Purchase intent already processed. Refresh and try again." },
          { status: 409 }
        );
      }
      throw error;
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { subscriptionStatus: true, subscriptionExpiresAt: true },
    });

    return NextResponse.json({
      success: true,
      tokensAdded,
      newBalance,
      idempotent,
      subscriptionStatus: user?.subscriptionStatus || "none",
      subscriptionExpiresAt: user?.subscriptionExpiresAt?.toISOString() || null,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
