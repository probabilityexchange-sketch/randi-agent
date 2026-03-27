export type TransactionType = "PURCHASE" | "USAGE" | "REFUND";
export type TransactionStatus = "PENDING" | "CONFIRMED" | "FAILED" | "EXPIRED";

export interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  usdAmount: string;
}

export interface PurchaseIntentResponse {
  intentId: string;
  expectedAmount: string;
  mint: string;
  treasury: string;
  expiresAt: string;
}

export interface PurchaseInitResponse {
  transactionId: string;
  paymentAsset: "spl" | "sol";
  tokenMint: string | null;
  treasuryWallet: string;
  burnWallet: string | null;
  tokenAmount: string;
  burnAmount?: string;
  grossTokenAmount?: string;
  memo: string;
  decimals: number;
  intentExpiresAt?: string;
  quote?: {
    packageUsd: string;
    tokenUsdPrice: string;
    tokenAmountDisplay: string;
    source: string;
    burnBps: number;
  };
}

export interface TokenTransaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  txSignature: string | null;
  description: string | null;
  createdAt: string;
}
