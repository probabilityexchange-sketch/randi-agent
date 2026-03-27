import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { provisionContainer, ProvisioningError } from "@/lib/docker/provisioner";
import { cleanupExpiredContainers } from "@/lib/docker/cleanup";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { ensureUserHasUsername } from "@/lib/utils/username";
import { getBestBridgeNode } from "@/lib/compute/bridge-client";
import {
  buildStorageKey,
  hasSnapshot,
  getSnapshotDownloadUrl,
} from "@/lib/storage/storage-service";

const provisionSchema = z.object({
  agentId: z.string().min(1),
  hours: z.number().int().min(1).max(72),
});

function mapProvisioningError(error: ProvisioningError): {
  status: number;
  payload: { error: string; detail?: string };
} {
  switch (error.code) {
    case "AGENT_NOT_AVAILABLE":
      return {
        status: 404,
        payload: { error: "Agent not available", detail: error.message },
      };
    case "DOCKER_NETWORK_NOT_FOUND":
      return {
        status: 500,
        payload: { error: "Docker network is not available", detail: error.message },
      };
    case "DOCKER_IMAGE_PULL_FAILED":
      return {
        status: 500,
        payload: {
          error: "Failed to pull agent image from registry",
          detail: error.message,
        },
      };
    case "DOCKER_CONTAINER_CREATE_FAILED":
      return {
        status: 500,
        payload: { error: "Failed to create agent container", detail: error.message },
      };
    case "DOCKER_CONTAINER_START_FAILED":
      return {
        status: 500,
        payload: { error: "Agent container failed to start", detail: error.message },
      };
    default:
      return {
        status: 500,
        payload: { error: "Failed to provision agent container", detail: error.message },
      };
  }
}

export async function GET() {
  try {
    const auth = await requireAuth();

    // Lazy cleanup of expired containers
    await cleanupExpiredContainers().catch((e) =>
      console.error("Lazy cleanup failed", e)
    );

    const containers = await prisma.container.findMany({
      where: { userId: auth.userId },
      include: { agent: { select: { name: true, slug: true, tokensPerHour: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      containers: containers.map((c) => ({
        id: c.id,
        dockerId: c.dockerId,
        subdomain: c.subdomain,
        agentId: c.agentId,
        agentName: c.agent.name,
        agentSlug: c.agent.slug,
        status: c.status,
        url: c.url,
        password: c.password,
        tokensUsed: c.tokensUsed,
        expiresAt: c.expiresAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest) {
  let createdContainerId: string | null = null;
  let tokensReserved = 0;
  let userId: string | null = null;

  try {
    const auth = await requireAuth();
    userId = auth.userId;

    const rateLimit = await checkRateLimit(
      `provision:${auth.userId}`,
      RATE_LIMITS.provision
    );
    if (!rateLimit.allowed) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      );
      return NextResponse.json(
        {
          error: "Too many provisioning requests. Please wait and try again.",
          retryAfterSec,
        },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const body = await request.json();
    const parsed = provisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { agentId, hours } = parsed.data;

    // 1. Transaction: Check balance, reserve tokens, and create "PROVISIONING" record
    const provisionData = await prisma.$transaction(async (tx) => {
      const agent = await tx.agentConfig.findUnique({ where: { id: agentId } });
      if (!agent || !agent.active) throw new Error("AGENT_NOT_FOUND");

      const user = await tx.user.findUnique({ where: { id: auth.userId } });
      if (!user) throw new Error("USER_NOT_FOUND");

      // Check user's tier against agent's required tier
      const userTier = user.tier || "FREE";
      const requiredTier = agent.requiredTier || "FREE";

      if (requiredTier !== "BOTH" && requiredTier !== userTier) {
        if (requiredTier === "PRO") {
          throw new Error("TIER_REQUIRED_PRO");
        } else {
          throw new Error("TIER_REQUIRED_FREE");
        }
      }

      const tokensNeeded = hours * agent.tokensPerHour;

      if (user.tokenBalance < tokensNeeded) throw new Error("INSUFFICIENT_TOKENS");
      const resolvedUsername =
        user.username ?? (await ensureUserHasUsername(tx, user.id, user.walletAddress ?? ""));

      tokensReserved = tokensNeeded;

      await tx.user.update({
        where: { id: auth.userId },
        data: { tokenBalance: { decrement: tokensNeeded } },
      });

      const decimals = Number(process.env.TOKEN_DECIMALS || process.env.NEXT_PUBLIC_TOKEN_DECIMALS || "6");
      const tokenAmountBaseUnits = BigInt(tokensNeeded) * BigInt(10 ** decimals);
      const burnBps = 7000; // 70% burn
      const memo = `ap:usage:${Date.now()}:${auth.userId.slice(-6)}:b${burnBps}`;

      await tx.tokenTransaction.create({
        data: {
          userId: auth.userId,
          type: "USAGE",
          status: "CONFIRMED",
          amount: -tokensNeeded,
          tokenAmount: tokenAmountBaseUnits,
          memo,
          description: `Provisioning ${agent.name} for ${hours}h`,
        },
      });

      // Create initial container record
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      const container = await tx.container.create({
        data: {
          userId: auth.userId,
          agentId: agent.id,
          subdomain: `temp-${nanoid(10)}`, // temporary, will be updated by provisioner
          status: "PROVISIONING",
          tokensUsed: tokensNeeded,
          expiresAt,
        },
      });

      return {
        containerId: container.id,
        agentSlug: agent.slug,
        username: resolvedUsername,
        agentName: agent.name,
      };
    });

    createdContainerId = provisionData.containerId;

    // 2. Provision Docker container (restore from snapshot if one exists)
    let result;
    try {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { tier: true },
      });

      // Check for an existing persistent storage snapshot to restore
      const storageKey = buildStorageKey(auth.userId, provisionData.agentSlug);
      let snapshotUrl: string | undefined;
      if (await hasSnapshot(storageKey)) {
        snapshotUrl = (await getSnapshotDownloadUrl(storageKey)) ?? undefined;
        
        // --- HOLE 1: PRE-WARMING ---
        if (snapshotUrl) {
          const bridge = await getBestBridgeNode();
          if (bridge) {
            console.log(`[Compute] Pre-warming bridge node ${bridge.getNodeId()} with snapshot...`);
            // Fire and forget (don't await to avoid blocking)
            bridge.prewarm(snapshotUrl, storageKey).catch(() => {});
          }
        }
        // ---------------------------
        
        console.log(`[Storage] Found snapshot for ${provisionData.agentSlug}, will restore.`);
      }

      result = await provisionContainer(
        auth.userId,
        provisionData.agentSlug,
        provisionData.username,
        user?.tier || "FREE",
        snapshotUrl
      );
    } catch (dockerError) {
      console.error("Docker provisioning failed:", dockerError);
      if (dockerError instanceof ProvisioningError) {
        throw dockerError;
      }
      throw new ProvisioningError(
        "DOCKER_PROVISION_FAILED",
        dockerError instanceof Error
          ? dockerError.message
          : "Unknown provisioning failure"
      );
    }

    // 3. Update container record with final status and Docker metadata
    await prisma.container.update({
      where: { id: createdContainerId },
      data: {
        status: "RUNNING",
        dockerId: result.dockerId,
        subdomain: result.subdomain,
        url: result.url,
        password: result.password,
      },
    });

    return NextResponse.json({
      containerId: createdContainerId,
      url: result.url,
      password: result.password,
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
    });

  } catch (error: unknown) {
    // Handle rollbacks if we failed after reserving tokens
    if (userId && tokensReserved > 0 && createdContainerId) {
      try {
        await prisma.$transaction(async (tx) => {
          // Refund tokens
          await tx.user.update({
            where: { id: userId! },
            data: { tokenBalance: { increment: tokensReserved } },
          });

          // Record refund
          await tx.tokenTransaction.create({
            data: {
              userId: userId!,
              type: "REFUND",
              status: "CONFIRMED",
              amount: tokensReserved,
              containerId: createdContainerId!,
              description: `Refund for failed provisioning`,
            },
          });

          // Update container status
          await tx.container.update({
            where: { id: createdContainerId! },
            data: { status: "ERROR" },
          });
        });
      } catch (rollbackError) {
        console.error("Critical: Rollback failed!", rollbackError);
      }
    }

    if (error instanceof Error) {
      if (error instanceof ProvisioningError) {
        const mapped = mapProvisioningError(error);
        return NextResponse.json(mapped.payload, { status: mapped.status });
      }

      const message = error.message;
      if (message === "AGENT_NOT_FOUND") return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      if (message === "INSUFFICIENT_TOKENS") return NextResponse.json({ error: "Insufficient tokens" }, { status: 402 });
      if (message === "TIER_REQUIRED_PRO") return NextResponse.json({
        error: "Pro subscription required",
        detail: "This agent requires a Pro subscription. Please upgrade to access this agent.",
        upgradeRequired: true
      }, { status: 403 });
      if (message === "TIER_REQUIRED_FREE") return NextResponse.json({
        error: "Free tier not allowed",
        detail: "This agent is only available to Pro subscribers.",
        upgradeRequired: true
      }, { status: 403 });
      if (message === "USERNAME_GENERATION_FAILED") {
        return NextResponse.json(
          { error: "Unable to prepare account profile" },
          { status: 500 }
        );
      }
      if (message === "DOCKER_PROVISION_FAILED") return NextResponse.json({ error: "Failed to provision agent container" }, { status: 500 });
    }

    return handleAuthError(error);
  }
}
