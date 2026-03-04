// IMPORTANT: BURN_BPS is the single source of truth — imported from tokenomics.ts.
// The previous parseBurnBps() function that defaulted to 1000 (10%) has been removed.
// All burn calculations MUST use BURN_BPS from tokenomics to stay in sync with
// the published BURN_SCHEDULE.md policy.
import { BURN_BPS } from "@/lib/tokenomics";

const USD_SCALE = 6;
const PRICE_SCALE = 12;
const DEFAULT_CACHE_MS = 20_000;
const DEFAULT_SOL_BURN_WALLET = "1nc1nerator11111111111111111111111111111111";
const DEFAULT_MIN_LIQUIDITY_USD = 0;

type PriceQuote = {
  mint: string;
  priceUsd: string;
  source: string;
  pairAddress?: string;
  fetchedAtMs: number;
};

const globalPriceCache = globalThis as unknown as {
  tokenPriceQuote?: PriceQuote;
};

function pow10(value: number): bigint {
  let result = BigInt(1);
  for (let i = 0; i < value; i += 1) result *= BigInt(10);
  return result;
}

function parseScaledDecimal(input: string, scale: number): bigint {
  const value = input.trim();
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error(`Invalid decimal value: ${input}`);
  }

  const [whole, frac = ""] = value.split(".");
  const paddedFrac = (frac + "0".repeat(scale)).slice(0, scale);
  return BigInt(whole) * pow10(scale) + BigInt(paddedFrac);
}

function divCeil(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - BigInt(1)) / denominator;
}

function formatAmount(amountBaseUnits: bigint, decimals: number, maxFraction = 6): string {
  const divisor = pow10(decimals);
  const whole = amountBaseUnits / divisor;
  const fraction = amountBaseUnits % divisor;

  if (fraction === BigInt(0) || maxFraction <= 0) return whole.toString();

  const fractionFull = fraction.toString().padStart(decimals, "0");
  const clipped = fractionFull.slice(0, Math.min(maxFraction, decimals)).replace(/0+$/, "");

  return clipped.length > 0 ? `${whole.toString()}.${clipped}` : whole.toString();
}

function getPriceCacheMs(): number {
  const raw = Number(process.env.TOKEN_PRICE_CACHE_MS || DEFAULT_CACHE_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_CACHE_MS;
  return raw;
}

function getMinLiquidityUsd(): number {
  const raw = Number(process.env.TOKEN_PRICE_MIN_LIQUIDITY_USD || DEFAULT_MIN_LIQUIDITY_USD);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_MIN_LIQUIDITY_USD;
  return raw;
}

function getAllowedPairAddresses(): Set<string> {
  const raw = process.env.TOKEN_PRICE_ALLOWED_PAIR_ADDRESSES?.trim();
  if (!raw) return new Set<string>();

  const addresses = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  return new Set(addresses);
}

async function fetchDexScreenerPriceUsd(
  mint: string
): Promise<{ priceUsd: string; pairAddress?: string }> {
  const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`DexScreener request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    pairs?: Array<{
      chainId?: string;
      pairAddress?: string;
      priceUsd?: string;
      liquidity?: { usd?: number | string };
    }>;
  };

  const minLiquidityUsd = getMinLiquidityUsd();
  const allowedPairs = getAllowedPairAddresses();

  const solanaPairs = (data.pairs || [])
    .filter((pair) => pair.chainId === "solana")
    .map((pair) => {
      const liquidity = Number(pair.liquidity?.usd || 0);
      return {
        pairAddress: pair.pairAddress || "",
        priceUsd: pair.priceUsd || "",
        liquidity: Number.isFinite(liquidity) ? liquidity : 0,
      };
    })
    .filter((pair) => /^\d+(\.\d+)?$/.test(pair.priceUsd) && Number(pair.priceUsd) > 0)
    .filter((pair) => pair.liquidity >= minLiquidityUsd)
    .filter((pair) =>
      allowedPairs.size === 0 || allowedPairs.has(pair.pairAddress.toLowerCase())
    );

  if (solanaPairs.length === 0) {
    if (allowedPairs.size > 0) {
      throw new Error("No allowlisted Solana price pairs found on DexScreener");
    }
    throw new Error(
      `No valid Solana price pairs found on DexScreener above min liquidity ${minLiquidityUsd} USD`
    );
  }

  solanaPairs.sort((a, b) => b.liquidity - a.liquidity);
  return {
    priceUsd: solanaPairs[0].priceUsd,
    pairAddress: solanaPairs[0].pairAddress || undefined,
  };
}

export async function getTokenUsdPrice(mint: string): Promise<{
  priceUsd: string;
  source: string;
  pairAddress?: string;
  isFallback?: boolean;
}> {
  const override = process.env.TOKEN_USD_PRICE_OVERRIDE?.trim();
  if (override && /^\d+(\.\d+)?$/.test(override) && Number(override) > 0) {
    return { priceUsd: override, source: "env_override" };
  }

  const now = Date.now();
  const cacheMs = getPriceCacheMs();
  const cached = globalPriceCache.tokenPriceQuote;
  if (cached && cached.mint === mint && now - cached.fetchedAtMs < cacheMs) {
    return {
      priceUsd: cached.priceUsd,
      source: cached.source,
      pairAddress: cached.pairAddress,
    };
  }

  try {
    const fetched = await fetchDexScreenerPriceUsd(mint);
    const source = fetched.pairAddress
      ? `dexscreener:${fetched.pairAddress}`
      : "dexscreener";
    globalPriceCache.tokenPriceQuote = {
      mint,
      priceUsd: fetched.priceUsd,
      source,
      pairAddress: fetched.pairAddress,
      fetchedAtMs: now,
    };

    return {
      priceUsd: fetched.priceUsd,
      source,
      pairAddress: fetched.pairAddress,
    };
  } catch (error) {
    console.warn(`[Pricing] DexScreener lookup failed for ${mint}, using micro-fallback:`, error);
    return {
      priceUsd: "0.000001", // Tiny fallback to keep UI alive
      source: "fallback_recovery",
      isFallback: true,
    };
  }
}

export const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function getSolUsdPrice(): Promise<string> {
  try {
    const fetched = await fetchDexScreenerPriceUsd(SOL_MINT);
    return fetched.priceUsd;
  } catch (err) {
    console.warn("[Pricing] Failed to fetch SOL price:", err);
    return "100.00"; // Fallback
  }
}

/**
 * Split a gross token amount into burn and treasury portions.
 */
export function splitTokenAmountsByBurn(
  grossTokenAmount: bigint,
  burnBps: number = BURN_BPS
): {
  burnBps: number;
  burnTokenAmount: bigint;
  treasuryTokenAmount: bigint;
} {
  const burnTokenAmount = (grossTokenAmount * BigInt(burnBps)) / BigInt(10_000);
  const treasuryTokenAmount = grossTokenAmount - burnTokenAmount;

  return { burnBps, burnTokenAmount, treasuryTokenAmount };
}


export async function quoteTokenAmountForUsd(params: {
  usdAmount: string;
  tokenMint: string;
  tokenDecimals: number;
}): Promise<{
  usdAmount: string;
  tokenUsdPrice: string;
  tokenAmountBaseUnits: bigint;
  tokenAmountDisplay: string;
  source: string;
}> {
  const usdAmount = params.usdAmount.trim();
  if (!/^\d+(\.\d+)?$/.test(usdAmount) || Number(usdAmount) <= 0) {
    throw new Error(`Invalid USD amount configured: ${params.usdAmount}`);
  }

  const { priceUsd, source } = await getTokenUsdPrice(params.tokenMint);

  const usdScaled = parseScaledDecimal(usdAmount, USD_SCALE);
  const priceScaled = parseScaledDecimal(priceUsd, PRICE_SCALE);
  const tokenDecimalsPow = pow10(params.tokenDecimals);

  const numerator = usdScaled * tokenDecimalsPow * pow10(PRICE_SCALE);
  const denominator = priceScaled * pow10(USD_SCALE);
  const tokenAmountBaseUnits = divCeil(numerator, denominator);

  if (tokenAmountBaseUnits <= BigInt(0)) {
    throw new Error("Calculated token amount is zero");
  }

  return {
    usdAmount,
    tokenUsdPrice: priceUsd,
    tokenAmountBaseUnits,
    tokenAmountDisplay: formatAmount(tokenAmountBaseUnits, params.tokenDecimals),
    source,
  };
}

export function parseBurnBpsFromMemo(memo: string): number {
  const match = memo.match(/:b(\d{1,5})$/);
  if (!match) return 0; // Default to 0 if no burn specified in memo
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  if (parsed > 10_000) return 10_000;
  return Math.trunc(parsed);
}

export type PaymentAsset = "spl" | "sol";

export function resolvePaymentAsset(): PaymentAsset {
  const raw = (process.env.PAYMENT_ASSET || "spl").trim().toLowerCase();
  return raw === "sol" ? "sol" : "spl";
}

export function resolveSolBurnWallet(): string {
  const configured = process.env.SOL_BURN_WALLET?.trim();
  if (!configured) return DEFAULT_SOL_BURN_WALLET;
  return configured;
}
