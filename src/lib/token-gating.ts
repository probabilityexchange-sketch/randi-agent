/**
 * Token-Gating Library
 * 
 * Simplified: Removed staking-tier logic.
 * All models are now gated by credit balance (deductForAgentCall).
 */

import {
    TOKEN_MINT,
    TOKEN_DECIMALS,
    getModelTier,
} from "./tokenomics";

export type StakingLevel = "NONE" | "BRONZE" | "SILVER" | "GOLD";

export const RANDI_TOKEN_MINT = TOKEN_MINT;
export const RANDI_TOKEN_DECIMALS = TOKEN_DECIMALS || 6;

/**
 * Legacy compatibility: Shell for STAKING_TIERS
 */
export const STAKING_TIERS: Record<StakingLevel, { threshold: number; label: string }> = {
    NONE: { threshold: 0, label: "Free Tier" },
    BRONZE: { threshold: 1_000, label: "Bronze (Legacy)" },
    SILVER: { threshold: 10_000, label: "Silver (Legacy)" },
    GOLD: { threshold: 100_000, label: "Gold (Legacy)" },
};

/**
 * Check if a model is considered 'Premium' or 'Ultra'.
 */
export function isPremiumModel(model: string): boolean {
    const tier = getModelTier(model);
    return tier === "PREMIUM" || tier === "ULTRA";
}

/**
 * Legacy compatibility: return true for all.
 * Access is now controlled by credit balance in the deduction engine.
 */
export function validateModelAccess(
    model: string,
    _userStakingLevel?: any
): { allowed: boolean; reason?: string } {
    return { allowed: true };
}

/**
 * Legacy compatibility: return NONE
 */
export function getStakingLevel(_stakedAmount: number | bigint): StakingLevel {
    return "NONE";
}

/**
 * Legacy compatibility: return null
 */
export function getNextTier(_currentLevel: StakingLevel): StakingLevel | null {
    return null;
}

/**
 * Legacy compatibility: return 0
 */
export function getTierProgress(_stakedAmount: number | bigint): number {
    return 0;
}

/**
 * Legacy compatibility: return 0
 */
export function getAmountToNextTier(_stakedAmount: number | bigint): number {
    return 0;
}

/**
 * Legacy compatibility: return threshold
 */
export function getTierThreshold(tier: StakingLevel): number {
    return STAKING_TIERS[tier].threshold;
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(amount: number | bigint, decimals: number = 6): string {
    const tokens = typeof amount === "bigint"
        ? Number(amount / BigInt(10 ** decimals))
        : amount;
    return tokens.toLocaleString();
}
