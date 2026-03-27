import test from "node:test";
import assert from "node:assert/strict";
import { createPurchaseIntent, verifyAndCreditIntent } from "../src/lib/payments/credits-ledger";

type Intent = {
  id: string;
  userId: string;
  packageId: string;
  expectedAmount: bigint;
  mint: string;
  treasury: string;
  status: "PENDING" | "CONFIRMED" | "EXPIRED" | "FAILED";
  expiresAt: Date;
  createdAt: Date;
  confirmedAt: Date | null;
  txSig: string | null;
};

function createFakePrisma() {
  const packages = new Map<string, any>([
    ["small", { id: "pkg-small", code: "small", credits: 100, priceTokens: BigInt(1000), mint: "mint-1", enabled: true }],
  ]);

  const users = new Map<string, any>([["user-1", { id: "user-1", creditBalance: 0 }]]);
  const intents = new Map<string, Intent>();
  const ledger = new Map<string, any>();

  let lock: Promise<void> = Promise.resolve();

  const tx = {
    $queryRaw: async () => {},
    purchaseIntent: {
      findUnique: async ({ where: { id } }: any) => {
        const intent = intents.get(id);
        if (!intent) return null;
        return {
          ...intent,
          package: [...packages.values()].find((p) => p.id === intent.packageId),
        };
      },
      update: async ({ where: { id }, data }: any) => {
        const existing = intents.get(id);
        if (!existing) throw new Error("missing intent");
        if (data.txSig) {
          const duplicate = [...intents.values()].find((v) => v.id !== id && v.txSig === data.txSig);
          if (duplicate) {
            const err: any = new Error("duplicate");
            err.code = "P2002";
            throw err;
          }
        }
        intents.set(id, { ...existing, ...data });
        return intents.get(id);
      },
    },
    creditLedger: {
      create: async ({ data }: any) => {
        if (ledger.has(data.intentId)) {
          const err: any = new Error("duplicate");
          err.code = "P2002";
          throw err;
        }
        ledger.set(data.intentId, data);
        return data;
      },
    },
    user: {
      update: async ({ where: { id }, data }: any) => {
        const u = users.get(id);
        users.set(id, { ...u, creditBalance: u.creditBalance + data.creditBalance.increment });
      },
    },
  };

  const prisma: any = {
    creditPackage: {
      findFirst: async ({ where: { code, enabled } }: any) => {
        const pkg = packages.get(code);
        return pkg && pkg.enabled === enabled ? pkg : null;
      },
    },
    purchaseIntent: {
      create: async ({ data, select }: any) => {
        const id = `intent-${intents.size + 1}`;
        const value: Intent = {
          id,
          userId: data.userId,
          packageId: data.packageId,
          expectedAmount: data.expectedAmount,
          mint: data.mint,
          treasury: data.treasury,
          status: data.status,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
          confirmedAt: null,
          txSig: null,
        };
        intents.set(id, value);
        return Object.fromEntries(Object.keys(select).map((k) => [k, (value as any)[k]]));
      },
    },
    $transaction: async (fn: any) => {
      const prev = lock;
      let release: () => void;
      lock = new Promise<void>((r) => (release = r));
      await prev;
      try {
        return await fn(tx);
      } finally {
        release!();
      }
    },
    _state: { intents, users, ledger },
  };

  return prisma;
}

test("createPurchaseIntent creates a pending intent with expected fields", async () => {
  process.env.TREASURY_WALLET = "treasury-1";
  const prisma = createFakePrisma();

  const intent = await createPurchaseIntent({ prisma, userId: "user-1", packageCode: "small" });

  assert.equal(intent.mint, "mint-1");
  assert.equal(intent.expectedAmount, BigInt(1000));
  assert.equal(intent.treasury, "treasury-1");
});

test("verifying same intent twice does not double-credit", async () => {
  process.env.TREASURY_WALLET = "treasury-1";
  const prisma = createFakePrisma();
  const intent = await createPurchaseIntent({ prisma, userId: "user-1", packageCode: "small" });

  await verifyAndCreditIntent(
    { prisma, verifyOnChain: async () => {} },
    { userId: "user-1", intentId: intent.id, txSig: "sig-1" },
  );

  const second = await verifyAndCreditIntent(
    { prisma, verifyOnChain: async () => {} },
    { userId: "user-1", intentId: intent.id, txSig: "sig-1" },
  );

  assert.equal(second.status, "already_confirmed");
  assert.equal(prisma._state.users.get("user-1").creditBalance, 100);
  assert.equal(prisma._state.ledger.size, 1);
});

test("parallel verify calls cannot double-credit", async () => {
  process.env.TREASURY_WALLET = "treasury-1";
  const prisma = createFakePrisma();
  const intent = await createPurchaseIntent({ prisma, userId: "user-1", packageCode: "small" });

  await Promise.all([
    verifyAndCreditIntent(
      { prisma, verifyOnChain: async () => {} },
      { userId: "user-1", intentId: intent.id, txSig: "sig-concurrent" },
    ),
    verifyAndCreditIntent(
      { prisma, verifyOnChain: async () => {} },
      { userId: "user-1", intentId: intent.id, txSig: "sig-concurrent" },
    ),
  ]);

  assert.equal(prisma._state.users.get("user-1").creditBalance, 100);
  assert.equal(prisma._state.ledger.size, 1);
});
