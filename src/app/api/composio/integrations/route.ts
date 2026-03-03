import { NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import {
  getComposioClient,
  resolveComposioUserId,
} from "@/lib/composio/client";
import {
  COMPOSIO_TOOLKITS_DEDUPED,
  getComposioAuthConfigOverride,
  getComposioSharedEntityOverride,
} from "@/lib/composio/integrations";

// Use the deduped list as the canonical reference
const SUPPORTED_COMPOSIO_TOOLKITS = COMPOSIO_TOOLKITS_DEDUPED;

interface ConnectedAccountSummary {
  id: string;
  status: string;
  statusReason: string | null;
}

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

function pickPreferredAccount(accounts: ConnectedAccountSummary[]): ConnectedAccountSummary | null {
  if (accounts.length === 0) return null;
  return accounts.reduce((best, current) =>
    statusRank(current.status) > statusRank(best.status) ? current : best
  );
}

export async function GET() {
  try {
    const auth = await requireAuth();
    const composio = await getComposioClient();

    if (!composio) {
      return NextResponse.json(
        { error: "Composio is not configured (missing COMPOSIO_API_KEY)." },
        { status: 503 }
      );
    }
    const composioClient = composio;

    const composioUserId = resolveComposioUserId(auth.userId);
    const toolkitSlugs = SUPPORTED_COMPOSIO_TOOLKITS.map((toolkit) => toolkit.slug);

    const [connectedAccountsResponse, authConfigsPerToolkit] = await Promise.all([
      composioClient.connectedAccounts.list({
        userIds: [composioUserId],
        toolkitSlugs,
        limit: 100,
        orderBy: "updated_at",
      }),
      Promise.all(
        SUPPORTED_COMPOSIO_TOOLKITS.map(async (toolkit) => {
          const overrideAuthConfigId = getComposioAuthConfigOverride(toolkit.slug);
          if (overrideAuthConfigId) {
            return {
              toolkit: toolkit.slug,
              selectedAuthConfigId: overrideAuthConfigId,
              selectedAuthConfigName: "Env override",
              authConfigCount: null as number | null,
              authConfigError: null as string | null,
            };
          }

          try {
            const authConfigs = await composioClient.authConfigs.list({
              toolkit: toolkit.slug,
              limit: 20,
            });
            const scopedItems = authConfigs.items.filter(
              (item) => item.toolkit.slug === toolkit.slug
            );
            const selected =
              scopedItems.find((item) => item.status === "ENABLED") ??
              scopedItems[0] ??
              null;

            return {
              toolkit: toolkit.slug,
              selectedAuthConfigId: selected?.id ?? null,
              selectedAuthConfigName: selected?.name ?? null,
              authConfigCount: scopedItems.length,
              authConfigError: null as string | null,
            };
          } catch (error) {
            return {
              toolkit: toolkit.slug,
              selectedAuthConfigId: null,
              selectedAuthConfigName: null,
              authConfigCount: null as number | null,
              authConfigError:
                error instanceof Error ? error.message : "Failed to list auth configs",
            };
          }
        })
      ),
    ]);

    const accountsByToolkit = new Map<string, ConnectedAccountSummary[]>();
    for (const account of connectedAccountsResponse.items) {
      const slug = account.toolkit.slug;
      const existing = accountsByToolkit.get(slug) ?? [];
      existing.push({
        id: account.id,
        status: account.status,
        statusReason: account.statusReason ?? null,
      });
      accountsByToolkit.set(slug, existing);
    }

    const authConfigByToolkit = new Map(
      authConfigsPerToolkit.map((entry) => [entry.toolkit, entry])
    );

    const integrations = SUPPORTED_COMPOSIO_TOOLKITS.map((toolkit) => {
      const accounts = accountsByToolkit.get(toolkit.slug) ?? [];
      const preferredAccount = pickPreferredAccount(accounts);
      const authConfig = authConfigByToolkit.get(toolkit.slug);

      return {
        slug: toolkit.slug,
        label: toolkit.label,
        category: toolkit.category,
        icon: toolkit.icon,
        description: toolkit.description,
        hasAuthConfig: Boolean(authConfig?.selectedAuthConfigId),
        authConfigId: authConfig?.selectedAuthConfigId ?? null,
        authConfigName: authConfig?.selectedAuthConfigName ?? null,
        authConfigCount: authConfig?.authConfigCount ?? null,
        authConfigError: authConfig?.authConfigError ?? null,
        connectedAccountId: preferredAccount?.id ?? null,
        connectedStatus: preferredAccount?.status ?? "NOT_CONNECTED",
        connectedStatusReason: preferredAccount?.statusReason ?? null,
        connectedAccountCount: accounts.length,
        connected: preferredAccount?.status === "ACTIVE",
      };
    });

    console.log(`[Integrations] Returning ${integrations.length} toolkits for user ${composioUserId}`);
    return NextResponse.json({
      composioUserId,
      sharedEntityMode: Boolean(getComposioSharedEntityOverride()),
      integrations,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
