import { prisma } from "@/lib/db/prisma";
import { BURN_BPS } from "@/lib/tokenomics";
import { connection } from "@/lib/solana/connection";
import {
    PublicKey,
    Keypair,
    TransactionMessage,
    VersionedTransaction,
    TransactionInstruction
} from "@solana/web3.js";
import {
    getAssociatedTokenAddress,
    createBurnCheckedInstruction,
    TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import bs58 from "bs58";

export class BurnService {
    private treasuryWallet: string;
    private tokenMint: string;
    private burnBps: number;

    constructor(treasuryWallet: string, tokenMint: string, burnBps: number = BURN_BPS) {
        this.treasuryWallet = treasuryWallet;
        this.tokenMint = tokenMint;
        this.burnBps = burnBps;
    }

    /**
     * Scans for transactions that need to be burned and executes the batch burn if possible.
     */
    async processPendingBurns(): Promise<{
        burnedCount: number;
        totalTokensBurned: bigint;
        signature?: string
    }> {
        // 1. Find confirmed transactions without a burn signature
        const pendingTransactions = await prisma.tokenTransaction.findMany({
            where: {
                status: "CONFIRMED",
                type: { in: ["PURCHASE", "USAGE"] },
                burnTxSignature: null,
                tokenAmount: { not: null }
            }
        });

        if (pendingTransactions.length === 0) {
            return { burnedCount: 0, totalTokensBurned: BigInt(0) };
        }

        // 2. Calculate total to burn
        let totalGrossTokens = BigInt(0);
        for (const tx of pendingTransactions) {
            if (tx.tokenAmount) {
                totalGrossTokens += tx.tokenAmount;
            }
        }

        const burnAmount = (totalGrossTokens * BigInt(this.burnBps)) / BigInt(10_000);
        if (burnAmount === BigInt(0)) {
            return { burnedCount: 0, totalTokensBurned: BigInt(0) };
        }

        console.log(`Plan: Burn ${burnAmount.toString()} tokens for ${pendingTransactions.length} transactions.`);

        // 3. Attempt to execute on-chain if secret key is available
        const secretKeyStr = process.env.TREASURY_SECRET_KEY;
        let signature: string | undefined;

        if (secretKeyStr) {
            try {
                signature = await this.executeOnChainBurn(burnAmount);
                console.log(`Successfully executed batch burn: ${signature}`);
            } catch (err) {
                console.error("Batch burn execution failed:", err);
                throw err;
            }
        } else {
            console.warn("TREASURY_SECRET_KEY not set. Burn execution skipped.");
            // In a real prod environment, we might still mark them as "Accounted" 
            // but if we want to BE SURE, we should only mark if we have a signature.
            return { burnedCount: 0, totalTokensBurned: BigInt(0) };
        }

        // 4. Update transactions as burned
        if (signature) {
            await prisma.tokenTransaction.updateMany({
                where: { id: { in: pendingTransactions.map(tx => tx.id) } },
                data: { burnTxSignature: signature }
            });
        }

        return {
            burnedCount: pendingTransactions.length,
            totalTokensBurned: burnAmount,
            signature
        };
    }

    private async executeOnChainBurn(amount: bigint): Promise<string> {
        const secretKeyStr = process.env.TREASURY_SECRET_KEY;
        if (!secretKeyStr) throw new Error("Missing secret key");

        const treasury = Keypair.fromSecretKey(bs58.decode(secretKeyStr));
        const mintPubkey = new PublicKey(this.tokenMint);

        // Detect token program
        const mintAccount = await connection.getAccountInfo(mintPubkey);
        if (!mintAccount) throw new Error("Mint not found");
        const tokenProgramId = mintAccount.owner;

        const treasuryATA = await getAssociatedTokenAddress(mintPubkey, treasury.publicKey, false, tokenProgramId);

        // We assume decimals = 6 for $RANDI
        const decimals = 6;

        const burnIx = createBurnCheckedInstruction(
            treasuryATA,
            mintPubkey,
            treasury.publicKey,
            amount,
            decimals,
            [],
            tokenProgramId
        );

        const memoIx = new TransactionInstruction({
            keys: [{ pubkey: treasury.publicKey, isSigner: true, isWritable: false }],
            programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
            data: Buffer.from(`ap:protocol-batch-burn:${Date.now()}`, "utf-8"),
        });

        const { blockhash } = await connection.getLatestBlockhash();

        const message = new TransactionMessage({
            payerKey: treasury.publicKey,
            recentBlockhash: blockhash,
            instructions: [burnIx, memoIx],
        }).compileToV0Message();

        const tx = new VersionedTransaction(message);
        tx.sign([treasury]);

        const signature = await connection.sendTransaction(tx);
        await connection.confirmTransaction(signature);

        return signature;
    }
}

export async function runBurnService() {
    const treasury = process.env.TREASURY_WALLET;
    const mint = process.env.TOKEN_MINT || process.env.NEXT_PUBLIC_TOKEN_MINT;
    const burnBps = BURN_BPS;

    if (!treasury || !mint) {
        console.error("CRITICAL: Burn service requires TREASURY_WALLET and TOKEN_MINT environment variables.");
        return null;
    }

    const service = new BurnService(treasury, mint, burnBps);
    return service.processPendingBurns();
}
