import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import {
  getComposioClient,
  resolveComposioUserId,
} from "@/lib/composio/client";
import {
  getComposioAuthConfigOverride,
  isComposioToolkitSlug,
} from "@/lib/composio/integrations";

const schema = z.object({
  toolkit: z.string().min(1),
});

function normalizeBaseUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^['"]|['"]$/g, "");
  if (!normalized) return null;

  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
}

function getCallbackBaseUrl(request: NextRequest): string {
  return (
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrl(request.headers.get("origin")) ||
    request.nextUrl.origin
  );
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(`composio-connect:${auth.userId}`, RATE_LIMITS.general);
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

    let authConfigId = getComposioAuthConfigOverride(toolkit);
    if (!authConfigId) {
      const authConfigs = await composio.authConfigs.list({
        toolkit,
        limit: 20,
      });
      const scopedItems = authConfigs.items.filter(
        (item) => item.toolkit.slug === toolkit
      );

      authConfigId =
        scopedItems.find((item) => item.status === "ENABLED")?.id ??
        scopedItems[0]?.id ??
        null;
    }

    if (!authConfigId) {
      return NextResponse.json(
        {
          error:
            "No auth config found for this toolkit. Create one in Composio dashboard first.",
          code: "missing_auth_config",
        },
        { status: 400 }
      );
    }

    const callbackBaseUrl = getCallbackBaseUrl(request);
    const callbackUrl = `${callbackBaseUrl}/integrations?toolkit=${encodeURIComponent(
      toolkit
    )}`;

    const connectionRequest = await composio.connectedAccounts.link(
      composioUserId,
      authConfigId,
      { callbackUrl }
    );

    if (!connectionRequest.redirectUrl) {
      return NextResponse.json(
        { error: "Composio did not return a redirect URL for this connection request." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      redirectUrl: connectionRequest.redirectUrl,
      requestId: connectionRequest.id,
      toolkit,
      authConfigId,
      callbackUrl,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
