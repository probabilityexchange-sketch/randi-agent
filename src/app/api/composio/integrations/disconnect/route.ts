import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import {
  getComposioClient,
  resolveComposioUserId,
} from "@/lib/composio/client";
import { isComposioToolkitSlug } from "@/lib/composio/integrations";

const schema = z.object({
  toolkit: z.string().min(1),
  accountId: z.string().min(1).optional(),
});

function statusRank(status: string): number {
  switch (status) {
    case "ACTIVE":
      return 5;
    case "INITIATED":
      return 4;
    case "INITIALIZING":
      return 3;
    case "INACTIVE":
      return 2;
    case "EXPIRED":
      return 1;
    case "FAILED":
      return 0;
    default:
      return -1;
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(`composio-disconnect:${auth.userId}`, RATE_LIMITS.general);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const composio = await getComposioClient();

    if (!composio) {
      return NextResponse.json(
        { error: "Composio is not configured (missing COMPOSIO_API_KEY)." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const toolkit = parsed.data.toolkit.trim().toLowerCase();
    if (!isComposioToolkitSlug(toolkit)) {
      return NextResponse.json(
        { error: `Unsupported toolkit: ${toolkit}` },
        { status: 400 }
      );
    }

    const composioUserId = resolveComposioUserId(auth.userId);
    let accountId = parsed.data.accountId;

    if (!accountId) {
      const accounts = await composio.connectedAccounts.list({
        userIds: [composioUserId],
        toolkitSlugs: [toolkit],
        limit: 20,
      });

      const selected =
        accounts.items
          .slice()
          .sort((a, b) => statusRank(b.status) - statusRank(a.status))[0] ??
        null;
      accountId = selected?.id;
    }

    if (!accountId) {
      return NextResponse.json(
        { error: "No connected account found for this toolkit." },
        { status: 404 }
      );
    }

    await composio.connectedAccounts.disable(accountId);

    return NextResponse.json({
      success: true,
      toolkit,
      accountId,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
