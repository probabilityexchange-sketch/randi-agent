import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { connection } from "@/lib/solana/connection";
import {
    getStakingLevel,
    formatTokenAmount,
    RANDI_TOKEN_MINT,
    RANDI_TOKEN_DECIMALS,
    STAKING_TIERS,
} from "@/lib/token-gating";

interface ParsedTokenAccountData {
    parsed?: {
        info?: {
            tokenAmount?: {
                amount?: string;
            };
        };
    };
}

// Verify staking by scanning Solana for token holdings
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth();

        const { allowed } = await checkRateLimit(`staking-verify:${auth.userId}`, RATE_LIMITS.general);
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

        if (!user.walletAddress) {
            return NextResponse.json(
                { error: "No wallet address linked to account" },
                { status: 400 }
            );
        }

        // Check if there's an unconfirmed unstake - if so, we might be in lockup period
        if (user.unstakedAt) {
            // In a real implementation, check lockup period here
            // For now, we allow verification to proceed
        }

        try {
            const tokenMint = new PublicKey(RANDI_TOKEN_MINT);
            const walletAddress = new PublicKey(user.walletAddress);

            // 1. Resolve token program by checking mint account info
            const mintAccountInfo = await connection.getAccountInfo(tokenMint);
            if (!mintAccountInfo) {
                return NextResponse.json({ error: "Token mint not found on Solana" }, { status: 404 });
            }

            const tokenProgramId = mintAccountInfo.owner;

            // 2. Get the associated token account address with correct program ID
            const ata = await getAssociatedTokenAddress(
                tokenMint,
                walletAddress,
                false,
                tokenProgramId
            );

            // 3. Fetch the token account info
            const tokenAccountInfo = await connection.getAccountInfo(ata);
            let tokenBalance = BigInt(0);

            if (tokenAccountInfo) {
                // Parse account info based on program
                const tokenAccount = await connection.getParsedAccountInfo(ata);
                if (tokenAccount.value && "data" in tokenAccount.value) {
                    const data = tokenAccount.value.data;
                    if (typeof data === "object" && data !== null && "parsed" in data) {
                        const parsed = (data as ParsedTokenAccountData).parsed;
                        if (parsed?.info?.tokenAmount?.amount) {
                            tokenBalance = BigInt(parsed.info.tokenAmount.amount);
                        }
                    }
                }
            }

            // Determine if this qualifies for staking (above BRONZE threshold)
            const bronzeThreshold = BigInt(STAKING_TIERS.BRONZE.threshold) * BigInt(10 ** RANDI_TOKEN_DECIMALS);
            const isQualified = tokenBalance >= bronzeThreshold;
            const newStakingLevel = getStakingLevel(tokenBalance);

            // Update the user's staking info
            const stakedAmountWhole = Number(tokenBalance / BigInt(10 ** RANDI_TOKEN_DECIMALS));

            await prisma.user.update({
                where: { id: auth.userId },
                data: {
                    stakedAmount: stakedAmountWhole,
                    stakingLevel: newStakingLevel,
                    unstakedAt: null, // Clear unstake status if they have holdings
                },
            });

            return NextResponse.json({
                success: true,
                verified: true,
                walletAddress: user.walletAddress,
                tokenBalance: tokenBalance.toString(),
                tokenBalanceFormatted: formatTokenAmount(tokenBalance, RANDI_TOKEN_DECIMALS),
                previousStakedAmount: user.stakedAmount.toString(),
                previousStakingLevel: user.stakingLevel,
                currentStakingLevel: newStakingLevel,
                isQualified,
                threshold: bronzeThreshold.toString(),
                thresholdFormatted: formatTokenAmount(bronzeThreshold, RANDI_TOKEN_DECIMALS),
                updated: stakedAmountWhole !== user.stakedAmount,
            });
        } catch (error) {
            console.error("Solana verification error:", error);

            // If there's an error with Solana, return the error but allow manual retry
            return NextResponse.json(
                {
                    error: "Failed to verify token holdings on Solana",
                    details: error instanceof Error ? error.message : "Unknown error",
                    retryable: true,
                },
                { status: 502 }
            );
        }
    } catch (error) {
        return handleAuthError(error);
    }
}

// GET: Get the current staking verification status (without re-verifying)
export async function GET() {
    try {
        const auth = await requireAuth();

        const { allowed } = await checkRateLimit(`staking-verify:${auth.userId}`, RATE_LIMITS.general);
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
                updatedAt: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            walletAddress: user.walletAddress,
            stakedAmount: user.stakedAmount.toString(),
            stakedAmountFormatted: formatTokenAmount(user.stakedAmount),
            stakingLevel: user.stakingLevel,
            unstakedAt: user.unstakedAt?.toISOString() || null,
            lastVerified: user.updatedAt.toISOString(),
            canVerify: !!user.walletAddress,
        });
    } catch (error) {
        return handleAuthError(error);
    }
}
