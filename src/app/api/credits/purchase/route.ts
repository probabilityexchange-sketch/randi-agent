import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { getCreditPacks, BURN_BPS } from "@/lib/tokenomics";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import {
  resolvePaymentAsset,
  resolveSolBurnWallet,
  splitTokenAmountsByBurn,
  getSolUsdPrice,
} from "@/lib/payments/token-pricing";

const schema = z.object({
  packageId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(
      `purchase:${auth.userId}`,
      RATE_LIMITS.purchase
    );
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { packageId } = parsed.data;

    const packs = getCreditPacks();
    const pkg = packs.find(p => p.id === packageId);

    if (!pkg) {
      return NextResponse.json({ error: "Invalid package ID" }, { status: 400 });
    }

    const paymentAsset = resolvePaymentAsset(); // "sol" or "spl"
    const isSubscription = pkg.type === "subscription";

    let tokenAmountBaseUnits: bigint;
    let decimals: number;
    let tokenMint: string | null = null;
    let burnAmountBaseUnits: bigint = BigInt(0);
    let treasuryAmountBaseUnits: bigint;

    if (paymentAsset === "sol") {
      // Calculate SOL amount for pkg.usdPrice
      const solPriceUsd = await getSolUsdPrice();
      const solAmount = pkg.usdPrice / Number(solPriceUsd);
      decimals = 9; // SOL
      tokenAmountBaseUnits = BigInt(Math.floor(solAmount * 1_000_000_000));

      // For SOL, we burn 70% by sending it to incinerator
      const split = splitTokenAmountsByBurn(tokenAmountBaseUnits, BURN_BPS);
      burnAmountBaseUnits = split.burnTokenAmount;
      treasuryAmountBaseUnits = split.treasuryTokenAmount;
    } else {
      // Existing SPL logic
      decimals = 6;
      tokenMint = process.env.TOKEN_MINT || process.env.NEXT_PUBLIC_TOKEN_MINT || "";
      // In SPL mode, we assume user is paying pkg.creditAmount tokens directly?
      // No, let's keep it consistent: $X USD worth of $RANDI
      // Actually, if they pay in $RANDI, we can just use fixed token amounts from the pack.
      tokenAmountBaseUnits = BigInt(pkg.creditAmount) * BigInt(1_000_000);
      const split = splitTokenAmountsByBurn(tokenAmountBaseUnits, BURN_BPS);
      burnAmountBaseUnits = split.burnTokenAmount;
      treasuryAmountBaseUnits = split.treasuryTokenAmount;
    }

    const treasuryWallet = process.env.TREASURY_WALLET;
    if (!treasuryWallet) {
      throw new Error("TREASURY_WALLET not set");
    }

    const typePrefix = isSubscription ? "subscribe" : "deposit";
    const memo = `ap:${typePrefix}:${Date.now()}:${auth.userId.slice(-6)}:b${BURN_BPS}`;

    const tx = await prisma.tokenTransaction.create({
      data: {
        userId: auth.userId,
        type: isSubscription ? "SUBSCRIBE" : "PURCHASE",
        status: "PENDING",
        amount: pkg.creditAmount,
        tokenAmount: tokenAmountBaseUnits,
        memo,
        description: `${pkg.name} (${pkg.creditAmount.toLocaleString()} Credits) via ${paymentAsset.toUpperCase()}`,
      },
    });

    return NextResponse.json({
      transactionId: tx.id,
      paymentAsset,
      tokenMint,
      treasuryWallet,
      burnWallet: paymentAsset === "sol" ? resolveSolBurnWallet() : null,
      tokenAmount: treasuryAmountBaseUnits.toString(),
      burnAmount: burnAmountBaseUnits.toString(),
      grossTokenAmount: tokenAmountBaseUnits.toString(),
      memo,
      decimals,
      quote: {
        itemUsd: pkg.usdPrice.toString(),
        itemName: pkg.name,
        tokenAmountDisplay: pkg.creditAmount.toLocaleString(),
        burnBps: BURN_BPS,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 });
  }
}
