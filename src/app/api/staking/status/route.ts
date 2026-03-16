import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import {
    getNextTier,
    getTierProgress,
    getAmountToNextTier,
    formatTokenAmount,
    getTierThreshold,
    STAKING_TIERS,
    type StakingLevel,
} from "@/lib/token-gating";

// GET: Returns user's staking status, level, and required amount to next tier
export async function GET() {
    try {
        const auth = await requireAuth();

        const { allowed } = await checkRateLimit(`staking-status:${auth.userId}`, RATE_LIMITS.general);
        if (!allowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const user = await prisma.user.findUnique({
            where: { id: auth.userId },
            select: {
                id: true,
                walletAddress: true,
                stakedAmount: true,
                stakingLevel: true,
                unstakedAt: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const currentLevel = (user.stakingLevel || "NONE") as StakingLevel;
        const nextTier = getNextTier(currentLevel);
        const progress = getTierProgress(user.stakedAmount);
        const amountToNext = getAmountToNextTier(user.stakedAmount);

        return NextResponse.json({
            walletAddress: user.walletAddress,
            stakedAmount: user.stakedAmount,
            stakedAmountFormatted: `${user.stakedAmount.toLocaleString()} $RANDI`,
            stakingLevel: currentLevel,
            tierProgress: progress,
            nextTier: nextTier ? {
                level: nextTier,
                requiredAmount: getTierThreshold(nextTier),
                requiredAmountFormatted: `${getTierThreshold(nextTier).toLocaleString()} $RANDI`,
                amountNeeded: amountToNext,
                amountNeededFormatted: `${amountToNext.toLocaleString()} $RANDI`,
            } : null,
            unstakedAt: user.unstakedAt?.toISOString() || null,
            tiers: Object.fromEntries(
                (Object.keys(STAKING_TIERS) as StakingLevel[]).map((tier) => [
                    tier,
                    { amount: STAKING_TIERS[tier].threshold, label: STAKING_TIERS[tier].label },
                ])
            ),
        });
    } catch (error) {
        return handleAuthError(error);
    }
}

// POST: Record staking transaction (called after Solana confirms stake)
// NOTE: The staked amount is NOT accepted from the client. To update staking
// level, callers must use POST /api/staking/verify which reads balances
// directly from the Solana chain.
const stakeSchema = z.object({
    txSignature: z.string().min(1),
});

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth();

        const { allowed } = await checkRateLimit(`staking-status:${auth.userId}`, RATE_LIMITS.general);
        if (!allowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const body = await req.json();
        const parsed = stakeSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0].message },
                { status: 400 }
            );
        }

        const { txSignature } = parsed.data;

        // Check if user has a wallet address
        const user = await prisma.user.findUnique({
            where: { id: auth.userId },
            select: {
                id: true,
                walletAddress: true,
                stakedAmount: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (!user.walletAddress) {
            return NextResponse.json(
                { error: "No wallet address linked to account" },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Staking transaction noted. Use /api/staking/verify to confirm on-chain balance.",
            txSignature,
            nextAction: "verify",
        });
    } catch (error) {
        return handleAuthError(error);
    }
}

// DELETE: Unstake (sets unstakedAt, clears stakedAmount after lockup)
export async function DELETE(req: NextRequest) {
    try {
        const auth = await requireAuth();

        const { allowed } = await checkRateLimit(`staking-status:${auth.userId}`, RATE_LIMITS.general);
        if (!allowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const user = await prisma.user.findUnique({
            where: { id: auth.userId },
            select: {
                id: true,
                stakedAmount: true,
                stakingLevel: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (user.stakedAmount <= 0) {
            return NextResponse.json(
                { error: "No staked amount to withdraw" },
                { status: 400 }
            );
        }

        // Record the unstake request
        await prisma.user.update({
            where: { id: auth.userId },
            data: {
                unstakedAt: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            message: "Unstake initiated. Your staked tokens will be available after the lockup period.",
            unstakedAt: new Date().toISOString(),
        });
    } catch (error) {
        return handleAuthError(error);
    }
}
