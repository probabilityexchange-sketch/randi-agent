import { connection } from '@/lib/solana/connection';
import { PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { prisma } from '@/lib/db/prisma';
import { parseBurnBpsFromMemo } from '@/lib/payments/token-pricing';

export class TransactionScanner {
  private treasuryWallet: string;
  private tokenMint: string;

  constructor(treasuryWallet: string, tokenMint: string) {
    this.treasuryWallet = treasuryWallet;
    this.tokenMint = tokenMint;
  }

  private parseMemo(tx: ParsedTransactionWithMeta): string | null {
    const logMessages = tx.meta?.logMessages || [];
    for (const log of logMessages) {
      const quotedMatch = log.match(/Memo \(len \d+\): "(.+)"/);
      if (quotedMatch) return quotedMatch[1];
      const unquotedMatch = log.match(/Memo \(len \d+\): (.+)/);
      if (unquotedMatch) return unquotedMatch[1];
    }
    return null;
  }

  async scanRecentTransactions(limit = 25): Promise<number> {
    const treasuryPubKey = new PublicKey(this.treasuryWallet);
    const signatures = await connection.getSignaturesForAddress(treasuryPubKey, {
      limit,
    });

    const validSigs = signatures.filter(s => !s.err).map(s => s.signature);
    if (validSigs.length === 0) return 0;

    const existingTxs = await prisma.tokenTransaction.findMany({
      where: { txSignature: { in: validSigs } },
      select: { txSignature: true },
    });
    const processedSet = new Set(existingTxs.map(t => t.txSignature));

    const txsToProcess: Array<{ sig: string; memo: string | null }> = [];
    for (const sig of validSigs) {
      if (processedSet.has(sig)) continue;
      const tx = await connection.getParsedTransaction(sig, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      if (!tx) continue;
      const memo = this.parseMemo(tx);
      txsToProcess.push({ sig, memo });
    }

    const memos = txsToProcess.filter(t => t.memo?.startsWith('ap:')).map(t => t.memo!);

    const pendingIntents =
      memos.length > 0
        ? await prisma.tokenTransaction.findMany({
            where: { memo: { in: memos }, status: 'PENDING' },
            include: { user: true },
          })
        : [];
    const intentByMemo = new Map(pendingIntents.map(i => [i.memo, i]));

    let processedCount = 0;
    for (const { sig, memo } of txsToProcess) {
      if (!memo || !memo.startsWith('ap:')) continue;
      const intent = intentByMemo.get(memo);
      if (!intent) continue;

      const tx = await connection.getParsedTransaction(sig, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      if (!tx) continue;

      const preBalance = tx.meta?.preTokenBalances?.find(b => b.owner === this.treasuryWallet);
      const postBalance = tx.meta?.postTokenBalances?.find(b => b.owner === this.treasuryWallet);

      let actualTokenAmount: bigint | null = null;
      if (preBalance && postBalance) {
        actualTokenAmount =
          BigInt(postBalance.uiTokenAmount.amount) - BigInt(preBalance.uiTokenAmount.amount);
      }

      await prisma.$transaction(async tx => {
        await tx.tokenTransaction.update({
          where: { id: intent.id },
          data: { status: 'CONFIRMED', txSignature: sig, tokenAmount: actualTokenAmount },
        });
        if (intent.type === 'SUBSCRIBE') {
          await tx.user.update({
            where: { id: intent.userId },
            data: {
              subscriptionStatus: 'active',
              subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
        } else if (intent.type === 'PURCHASE') {
          await tx.user.update({
            where: { id: intent.userId },
            data: { tokenBalance: { increment: intent.amount } },
          });
        }
      });
      processedCount++;
    }

    return processedCount;
  }
}

export async function runScanner() {
  // FIX (HIGH): Removed hardcoded fallback addresses.
  // If these env vars are missing, the scanner skips gracefully rather than
  // silently scanning the wrong wallet.
  const treasury = process.env.TREASURY_WALLET;
  const mint = process.env.TOKEN_MINT || process.env.NEXT_PUBLIC_TOKEN_MINT;

  if (!treasury || !mint) {
    console.warn(
      'Scanner skipped: TREASURY_WALLET or TOKEN_MINT environment variables are not configured.'
    );
    return 0;
  }

  const scanner = new TransactionScanner(treasury, mint);
  return scanner.scanRecentTransactions();
}
