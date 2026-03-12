import { createHash } from "crypto";
import { Prisma } from "@/generated/prisma/client";

type UsernameClient = Pick<Prisma.TransactionClient, "user">;

function toSafeBase(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized.slice(0, 8) || "user";
}

function buildBaseUsername(walletAddress: string): string {
  const prefix = toSafeBase(walletAddress);
  const hash = createHash("sha256").update(walletAddress).digest("hex").slice(0, 6);
  return `u-${prefix}-${hash}`;
}

function withAttemptSuffix(base: string, attempt: number): string {
  if (attempt === 0) return base;
  const suffix = `-${attempt}`;
  const maxBaseLen = 20 - suffix.length;
  return `${base.slice(0, maxBaseLen)}${suffix}`;
}

export async function ensureUserHasUsername(
  client: UsernameClient,
  userId: string,
  walletAddress: string
): Promise<string> {
  const existing = await client.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  if (existing?.username) return existing.username;

  const base = buildBaseUsername(walletAddress);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = withAttemptSuffix(base, attempt);

    try {
      const result = await client.user.updateMany({
        where: { id: userId, username: null },
        data: { username: candidate },
      });

      if (result.count === 1) {
        return candidate;
      }

      const latest = await client.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      if (latest?.username) return latest.username;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("USERNAME_GENERATION_FAILED");
}
