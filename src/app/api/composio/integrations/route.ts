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

    // 1. Fetch ALL toolkits and ALL connected accounts
    const [allToolkits, connectedAccountsResponse] = await Promise.all([
      (composioClient.toolkits as any).get({ limit: 1000 }),
      composioClient.connectedAccounts.list({
        userIds: [composioUserId],
        limit: 500,
        orderBy: "updated_at",
      })
    ]);

    // 2. Map connected accounts by toolkit
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

    // 3. Merge with our curated metadata
    const curatedMap = new Map(SUPPORTED_COMPOSIO_TOOLKITS.map(t => [t.slug, t]));

    // We'll also check auth configs for only the curated ones to avoid excessive API calls
    const curatedSlugs = SUPPORTED_COMPOSIO_TOOLKITS.map(t => t.slug);
    const authConfigsPerToolkit = await Promise.all(
      curatedSlugs.map(async (slug) => {
        const overrideAuthConfigId = getComposioAuthConfigOverride(slug);
        if (overrideAuthConfigId) return { toolkit: slug, selected: overrideAuthConfigId };
        try {
          const configs = await composioClient.authConfigs.list({ toolkit: slug, limit: 1 });
          const active = configs.items.find(i => i.status === "ENABLED") || configs.items[0];
          return { toolkit: slug, selected: active?.id || null };
        } catch {
          return { toolkit: slug, selected: null };
        }
      })
    );
    const authConfigMap = new Map(authConfigsPerToolkit.map(e => [e.toolkit, e.selected]));

    interface Integration {
      slug: string;
      label: string;
      category: string;
      icon: string;
      description: string;
      logo: string | null;
      hasAuthConfig: boolean;
      authConfigId: string | null;
      connectedAccountId: string | null;
      connectedStatus: string;
      connectedStatusReason: string | null;
      connectedAccountCount: number;
      connected: boolean;
    }

    const integrations: Integration[] = allToolkits.map((toolkit: any) => {
      const curated = curatedMap.get(toolkit.slug);
      const accounts = accountsByToolkit.get(toolkit.slug) ?? [];
      const preferredAccount = pickPreferredAccount(accounts);
      const authConfigId = authConfigMap.get(toolkit.slug);

      // Use curated metadata if available, otherwise fallback to Composio meta
      const category = curated?.category || (toolkit.meta?.categories?.[0]?.name as any) || "Other";
      const icon = curated?.icon || "🧩";
      const description = curated?.description || toolkit.meta?.description || `Integration for ${toolkit.name}`;

      return {
        slug: toolkit.slug,
        label: curated?.label || toolkit.name,
        category,
        icon,
        description,
        logo: toolkit.meta?.logo || null,
        hasAuthConfig: Boolean(authConfigId),
        authConfigId: authConfigId || null,
        connectedAccountId: preferredAccount?.id ?? null,
        connectedStatus: preferredAccount?.status ?? "NOT_CONNECTED",
        connectedStatusReason: preferredAccount?.statusReason ?? null,
        connectedAccountCount: accounts.length,
        connected: preferredAccount?.status === "ACTIVE",
      };
    });

    // Sort: Connected first, then curated apps, then rest by usage/alphabetical
    integrations.sort((a: Integration, b: Integration) => {
      if (a.connected !== b.connected) return a.connected ? -1 : 1;
      const aCurated = curatedMap.has(a.slug);
      const bCurated = curatedMap.has(b.slug);
      if (aCurated !== bCurated) return aCurated ? -1 : 1;
      return a.label.localeCompare(b.label);
    });

    console.log(`[Integrations] Returning ${integrations.length} toolkits for user ${composioUserId}`);
    return NextResponse.json({
      composioUserId,
      sharedEntityMode: Boolean(getComposioSharedEntityOverride()),
      integrations,
    });
  } catch (error) {
    console.error("Integrations API Error:", error);
    return handleAuthError(error);
  }
}
