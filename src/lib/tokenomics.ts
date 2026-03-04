/**
 * $RANDI Tokenomics Configuration
 * Single source of truth for all pricing and burn rates.
 *
 * Design Principles:
 * - Users pay in $RANDI credits, tokens burn on use.
 * - 70% of usage fees are burned to reduce supply.
 * - 30% goes to treasury to cover API costs (Kilo Code, etc.).
 */

// ─── Token Config ────────────────────────────────────────────────────────────

export const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT
    || process.env.TOKEN_MINT
    || "FYAz1bPKJUFRwT4pzhUzdN3UqCN5ppXRL2pfto4zpump";

export const TOKEN_DECIMALS = 6;
export const TOTAL_SUPPLY = 1_000_000_000; // 1B $RANDI

// ─── Burn Schedule ──────────────────────────────────────────────────────────

export const BURN_BPS = 7_000; // 70% Burn
export const TREASURY_BPS = 3_000; // 30% Treasury

// ─── Agent Pricing (in $RANDI tokens) ──────────────────────
//
// Model tier mapping:
//   STANDARD  → Free models (Llama 3.3 70B:free, etc.)
//   PREMIUM   → GPT-4o, Claude 3.5 Sonnet
//   ULTRA     → o1, Claude Opus

export const AGENT_PRICING = {
    STANDARD: 5_000,
    PREMIUM: 30_000,
    ULTRA: 150_000,
} as const;

export type AgentTier = keyof typeof AGENT_PRICING;

// ─── Model → Tier Mapping ────────────────────────────────────────────────────

export const MODEL_TIERS: Record<string, AgentTier> = {
    "llama-3-70b": "STANDARD",
    "llama-3.1-8b": "STANDARD",
    "llama-3.1-70b": "STANDARD",
    "llama-3.2-90b": "STANDARD",
    "gemma-2-9b": "STANDARD",
    "mistral-7b": "STANDARD",
    "deepseek-v3": "STANDARD",
    "qwen-2.5-72b": "STANDARD",
    ":free": "STANDARD",

    "gpt-4o": "PREMIUM",
    "gpt-4o-mini": "PREMIUM",
    "gpt-4-turbo": "PREMIUM",
    "claude-3.5-sonnet": "PREMIUM",
    "claude-3-haiku": "PREMIUM",
    "anthropic/claude-3.5-sonnet": "PREMIUM",
    "mistral-large": "PREMIUM",

    "o1": "ULTRA",
    "o1-mini": "ULTRA",
    "o1-preview": "ULTRA",
    "o1-pro": "ULTRA",
    "claude-3-opus": "ULTRA",
    "anthropic/claude-3-opus": "ULTRA",
};

/**
 * Get the pricing tier for a model.
 */
export function getModelTier(model: string): AgentTier {
    if (model.includes(":free")) return "STANDARD";
    if (model in MODEL_TIERS) return MODEL_TIERS[model];

    for (const [prefix, tier] of Object.entries(MODEL_TIERS)) {
        if (model.startsWith(prefix)) return tier;
    }

    return "STANDARD";
}

/**
 * Get the full cost breakdown for an agent call.
 */
export function getCallCost(model: string) {
    const tier = getModelTier(model);
    const finalCost = AGENT_PRICING[tier];
    const burnAmount = Math.floor((finalCost * BURN_BPS) / 10_000);
    const treasuryAmount = finalCost - burnAmount;

    return {
        tier,
        finalCost,
        burnAmount,
        treasuryAmount,
    };
}

// ─── Credit Packs ─────────────────────────────────────────────────────────

export interface CreditPack {
    id: string;
    name: string;
    creditAmount: number;
    usdPrice: number;
    bonusPercent: number;
    estimatedStandardCalls: number;
    estimatedPremiumCalls: number;
    type?: "payg" | "subscription";
}

export function getCreditPacks(): CreditPack[] {
    return [
        {
            id: "starter",
            name: "Starter Credits",
            creditAmount: 100_000,
            usdPrice: 1,
            bonusPercent: 0,
            estimatedStandardCalls: Math.floor(100_000 / AGENT_PRICING.STANDARD),
            estimatedPremiumCalls: Math.floor(100_000 / AGENT_PRICING.PREMIUM),
            type: "payg"
        },
        {
            id: "builder",
            name: "Builder Credits",
            creditAmount: 550_000, // Includes 10% bonus implicitly or explicitly
            usdPrice: 5,
            bonusPercent: 10,
            estimatedStandardCalls: Math.floor(550_000 / AGENT_PRICING.STANDARD),
            estimatedPremiumCalls: Math.floor(550_000 / AGENT_PRICING.PREMIUM),
            type: "payg"
        },
        {
            id: "degen",
            name: "Degen Credits",
            creditAmount: 2_500_000, // Includes 25% bonus
            usdPrice: 20,
            bonusPercent: 25,
            estimatedStandardCalls: Math.floor(2_500_000 / AGENT_PRICING.STANDARD),
            estimatedPremiumCalls: Math.floor(2_500_000 / AGENT_PRICING.PREMIUM),
            type: "payg"
        },
        {
            id: "pro_monthly",
            name: "Randi Pro (Monthly)",
            creditAmount: 2_500_000,
            usdPrice: 20,
            bonusPercent: 25,
            estimatedStandardCalls: 500,
            estimatedPremiumCalls: 100,
            type: "subscription"
        }
    ];
}


// ─── Utility Helpers ─────────────────────────────────────────────────────────

export function toLamports(tokens: number): bigint {
    return BigInt(tokens) * BigInt(10 ** TOKEN_DECIMALS);
}

export function fromLamports(lamports: bigint): number {
    return Number(lamports / BigInt(10 ** TOKEN_DECIMALS));
}

export function formatRandi(tokens: number): string {
    return `${tokens.toLocaleString()} $RANDI`;
}
