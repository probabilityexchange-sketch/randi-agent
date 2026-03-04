import { prisma } from "@/lib/db/prisma";
import {
  getCallCost,
  toLamports,
  getCreditPacks,
} from "@/lib/tokenomics";

export { getCreditPacks };

/**
 * Deduct tokens from user balance for an agent call.
 * This is the primary function for charging users on a per-call basis.
 */
export async function deductForAgentCall(
  userId: string,
  model: string,
  description: string,
  chatSessionId?: string
): Promise<{ success: boolean; cost?: number; error?: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Get user
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          tokenBalance: true,
        },
      });

      if (!user) {
        return { success: false, error: "User not found" };
      }

      // 2. Calculate cost based on model
      const costDetails = getCallCost(model);
      const finalCost = costDetails.finalCost;

      // 3. Check if user has enough credits
      if (user.tokenBalance < finalCost) {
        return { success: false, error: "Insufficient $RANDI balance" };
      }

      // 4. Deduct from user balance
      await tx.user.update({
        where: { id: userId },
        data: { tokenBalance: { decrement: finalCost } },
      });

      // 5. Update ChatSession (if applicable)
      if (chatSessionId && chatSessionId !== "new") {
        try {
          await tx.chatSession.update({
            where: { id: chatSessionId },
            data: { tokensUsed: { increment: finalCost } },
          });
        } catch (e) {
          console.warn("Failed to update tokensUsed for session:", chatSessionId);
        }
      }

      // 6. Record transaction for burn processing
      await tx.tokenTransaction.create({
        data: {
          userId,
          type: "USAGE",
          status: "CONFIRMED",
          amount: -finalCost,
          tokenAmount: toLamports(finalCost),
          description: `[Call] ${model}: ${description}`,
        },
      });

      return { success: true, cost: finalCost };
    });
  } catch (error) {
    console.error("Deduction error:", error);
    return { success: false, error: "An internal error occurred. Please try again." };
  }
}

/**
 * Handle token deposit.
 * Bonus tokens are awarded based on the token pack.
 */
export async function depositTokens(
  userId: string,
  packId: string,
  txSignature: string,
  baseTokenAmount: bigint,
  memo: string
): Promise<void> {
  const packs = getCreditPacks();
  const pack = packs.find(p => p.id === packId);

  // Calculate bonus if pack found
  let bonusMultiplier = 1.0;
  if (pack) {
    bonusMultiplier = 1 + (pack.bonusPercent / 100);
  }

  // Convert BigInt base amount to tokens for bonus calculation
  // (Assuming decimals = 6 as per tokenomics)
  const decimals = 1_000_000;
  const wholeTokens = Number(baseTokenAmount / BigInt(decimals));
  const finalWholeTokens = Math.floor(wholeTokens * bonusMultiplier);

  await prisma.$transaction(async (tx) => {
    // 1. Claim the pending transaction record
    const claim = await tx.tokenTransaction.updateMany({
      where: { memo, userId, status: "PENDING" },
      data: {
        status: "CONFIRMED",
        txSignature,
        tokenAmount: baseTokenAmount,
        amount: finalWholeTokens,
      },
    });

    if (claim.count === 0) return;

    // 2. Update user balance
    await tx.user.update({
      where: { id: userId },
      data: { tokenBalance: { increment: finalWholeTokens } },
    });
  });
}

/**
 * Get user balance.
 */
export async function getUserWalletInfo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tokenBalance: true,
    },
  });

  if (!user) return null;

  return {
    tokenBalance: user.tokenBalance,
  };
}

/** Legacy support: redirects to new logic */
export async function deductCredits(
  userId: string,
  amount: number,
  description: string
): Promise<boolean> {
  const result = await deductForAgentCall(userId, "llama-3-70b", description);
  return result.success;
}
