import { Prisma, PrismaClient } from "@/generated/prisma/client";

export interface VerificationDeps {
  prisma: PrismaClient;
  verifyOnChain: (params: {
    txSig: string;
    mint: string;
    treasuryWallet: string;
    expectedAmount: bigint;
    intentId: string;
  }) => Promise<void>;
}

export async function createPurchaseIntent(params: {
  prisma: PrismaClient;
  userId: string;
  packageCode: string;
}) {
  const pkg = await params.prisma.creditPackage.findFirst({
    where: { code: params.packageCode, enabled: true },
  });

  if (!pkg) {
    throw new Error("PACKAGE_NOT_FOUND");
  }

  const treasury = process.env.TREASURY_WALLET;
  if (!treasury) {
    throw new Error("TREASURY_WALLET is not configured");
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  return params.prisma.purchaseIntent.create({
    data: {
      userId: params.userId,
      packageId: pkg.id,
      expectedAmount: pkg.priceTokens,
      mint: pkg.mint,
      treasury,
      status: "PENDING",
      expiresAt,
    },
    select: {
      id: true,
      expectedAmount: true,
      mint: true,
      treasury: true,
      expiresAt: true,
    },
  });
}

export async function verifyAndCreditIntent(
  deps: VerificationDeps,
  params: {
    userId: string;
    intentId: string;
    txSig: string;
  },
) {
  return deps.prisma.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM "PurchaseIntent" WHERE id = ${params.intentId} FOR UPDATE`;

    const intent = await tx.purchaseIntent.findUnique({
      where: { id: params.intentId },
      include: { package: true },
    });

    if (!intent || intent.userId !== params.userId) {
      throw new Error("INTENT_NOT_FOUND");
    }

    if (intent.status === "CONFIRMED") {
      return {
        status: "already_confirmed" as const,
        intent,
      };
    }

    if (intent.status !== "PENDING") {
      throw new Error(`INTENT_${intent.status}`);
    }

    if (intent.expiresAt < new Date()) {
      await tx.purchaseIntent.update({
        where: { id: intent.id },
        data: { status: "EXPIRED" },
      });
      throw new Error("INTENT_EXPIRED");
    }

    await deps.verifyOnChain({
      txSig: params.txSig,
      mint: intent.mint,
      treasuryWallet: intent.treasury,
      expectedAmount: intent.expectedAmount,
      intentId: intent.id,
    });

    try {
      await tx.purchaseIntent.update({
        where: { id: intent.id },
        data: {
          txSig: params.txSig,
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });

      await tx.creditLedger.create({
        data: {
          userId: intent.userId,
          intentId: intent.id,
          delta: intent.package.credits,
          reason: `purchase:${intent.package.code}`,
        },
      });

      await tx.user.update({
        where: { id: intent.userId },
        data: { creditBalance: { increment: intent.package.credits } },
      });

      return {
        status: "confirmed" as const,
        creditsAdded: intent.package.credits,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error as Prisma.PrismaClientKnownRequestError).code === "P2002"
      ) {
        const fresh = await tx.purchaseIntent.findUnique({ where: { id: intent.id } });
        if (fresh?.status === "CONFIRMED") {
          return { status: "already_confirmed" as const, intent: fresh };
        }
      }
      throw error;
    }
  });
}
