import {
  ParsedInstruction,
  PartiallyDecodedInstruction,
  PublicKey,
  ParsedTransactionWithMeta,
  TransactionSignature,
} from "@solana/web3.js";
import bs58 from "bs58";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { connection } from "@/lib/solana/connection";

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

export interface VerifiedPayment {
  txSig: string;
  slot: number;
}

function readMemo(ix: ParsedInstruction | PartiallyDecodedInstruction): string | null {
  if ("parsed" in ix && ix.programId.toBase58() === MEMO_PROGRAM_ID) {
    if (typeof ix.parsed === "string") return ix.parsed;
    if (typeof ix.parsed === "object" && ix.parsed && "memo" in ix.parsed) {
      const memo = (ix.parsed as { memo?: unknown }).memo;
      return typeof memo === "string" ? memo : null;
    }
  }

  if (!("parsed" in ix) && ix.programId.toBase58() === MEMO_PROGRAM_ID) {
    try {
      return Buffer.from(bs58.decode(ix.data)).toString("utf-8");
    } catch {
      return null;
    }
  }

  return null;
}

function instructionMatchesTransfer(
  ix: ParsedInstruction | PartiallyDecodedInstruction,
  mint: string,
  treasuryAta: string,
  expectedAmount: bigint,
): boolean {
  if (!("parsed" in ix) || ix.program !== "spl-token") return false;

  const parsed = ix.parsed as { type?: string; info?: Record<string, unknown> };
  if (!parsed.type || !parsed.info) return false;

  if (parsed.type !== "transferChecked" && parsed.type !== "transfer") return false;

  const destination = String(parsed.info.destination ?? "");
  const transferMint = String(parsed.info.mint ?? mint);

  const amountRaw =
    parsed.type === "transferChecked"
      ? (parsed.info.tokenAmount as { amount?: string } | undefined)?.amount
      : (parsed.info.amount as string | undefined);

  if (!amountRaw) return false;

  return transferMint === mint && destination === treasuryAta && BigInt(amountRaw) === expectedAmount;
}

function ensureTxConfirmed(tx: ParsedTransactionWithMeta | null): void {
  if (!tx) throw new Error("Transaction not found");
  if (tx.meta?.err) throw new Error("Transaction failed on-chain");
}

export async function verifyIntentPaymentOnChain(params: {
  txSig: TransactionSignature;
  mint: string;
  treasuryWallet: string;
  expectedAmount: bigint;
  intentId: string;
}): Promise<VerifiedPayment> {
  const commitment = (process.env.CONFIRMATION_LEVEL as "confirmed" | "finalized" | undefined) ?? "confirmed";

  const tx = await connection.getParsedTransaction(params.txSig, {
    commitment,
    maxSupportedTransactionVersion: 0,
  });

  ensureTxConfirmed(tx);
  const confirmedTx = tx!;

  const treasuryAta = getAssociatedTokenAddressSync(new PublicKey(params.mint), new PublicKey(params.treasuryWallet)).toBase58();

  const instructions = confirmedTx.transaction.message.instructions;
  const hasTransfer = instructions.some((ix) => instructionMatchesTransfer(ix, params.mint, treasuryAta, params.expectedAmount));

  if (!hasTransfer) {
    throw new Error("Transaction does not contain the expected treasury token transfer");
  }

  const hasIntentMemo = instructions.some((ix) => {
    const memo = readMemo(ix);
    return memo ? memo.includes(params.intentId) : false;
  });

  if (!hasIntentMemo) {
    throw new Error("Transaction memo/reference does not include intent id");
  }

  return {
    txSig: params.txSig,
    slot: confirmedTx.slot,
  };
}
