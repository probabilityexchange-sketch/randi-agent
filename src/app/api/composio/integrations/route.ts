import { NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import {
  getComposioClient,
  resolveComposioUserId,
} from "@/lib/composio/client";
import {
  COMPOSIO_TOOLKITS_DEDUPED,
  getComposioAuthConfigOverride,
  getComposioSharedEntityOverride,
} from "@/lib/composio/integrations";

const SUPPORTED_COMPOSIO_TOOLKITS = COMPOSIO_TOOLKITS_DEDUPED;

interface ConnectedAccountSummary {
  id: string;
  status: string;
  statusReason: string | null;
}

function statusRank(status: string): number {
  switch (status) {
    case "ACTIVE": return 5;
    case "INITIATED": return 4;
    case "INITIALIZING": return 3;
    case "INACTIVE": return 2;
    case "EXPIRED": return 1;
    case "FAILED": return 0;
    default: return -1;
  }
}

function pickPreferredAccount(accounts: ConnectedAccountSummary[]): ConnectedAccountSummary | null {
  if (accounts.length === 0) return null;
  return accounts.reduce((best, current) =>
    statusRank(current.status) > statusRank(best.status) ? current : best
  );
}

const curatedMap = new Map<string, any>(SUPPORTED_COMPOSIO_TOOLKITS.map(t => [t.slug, t]));

function normalizeCategory(raw: string | null | undefined): string {
  if (!raw) return "Other";
  const cat = raw.toLowerCase().trim();

  // Grouping logic
  if (cat.includes("communication") || cat.includes("chat") || cat.includes("email") || cat.includes("video") || cat.includes("conferencing") || cat.includes("sms") || cat.includes("phone")) {
    return "Communication";
  }
  if (cat.includes("productivity") || cat.includes("task") || cat.includes("project") || cat.includes("notes") || cat.includes("scheduling") || cat.includes("booking") || cat.includes("calendar")) {
    return "Productivity";
  }
  if (cat.includes("dev") || cat.includes("code") || cat.includes("it operations") || cat.includes("monitoring") || cat.includes("server") || cat.includes("cloud")) {
    return "Dev & Cloud";
  }
  if (cat.includes("data") || cat.includes("analytics") || cat.includes("database") || cat.includes("ai") || cat.includes("automation")) {
    return "Data & AI";
  }
  if (cat.includes("sales") || cat.includes("marketing") || cat.includes("crm") || cat.includes("drip") || cat.includes("ecommerce") || cat.includes("commerce")) {
    return "Sales & Marketing";
  }
  if (cat.includes("finance") || cat.includes("payment") || cat.includes("tax") || cat.includes("invoice") || cat.includes("accounting") || cat.includes("banking")) {
    return "Finance";
  }
  if (cat.includes("design") || cat.includes("image") || cat.includes("video") || cat.includes("audio") || cat.includes("media") || cat.includes("transcription")) {
    return "Creative & Media";
  }
  if (cat.includes("hr") || cat.includes("human resources") || cat.includes("recruitment") || cat.includes("education")) {
    return "HR & Education";
  }
  if (cat.includes("security") || cat.includes("identity") || cat.includes("verifiable")) {
    return "Security";
  }

  // Fallback to title case
  return raw.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

export async function GET() {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(`composio-integrations:${auth.userId}`, RATE_LIMITS.general);
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

    // We'll also check auth configs for only the curated ones to avoid excessive API calls
    const curatedSlugs: string[] = SUPPORTED_COMPOSIO_TOOLKITS.map((t: any) => t.slug);
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
    const authConfigMap = new Map<string, string | null>(authConfigsPerToolkit.map(e => [e.toolkit, e.selected]));

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
      capabilities: string[];
      suggestedPrompt: string | null;
    }

    const integrations: Integration[] = allToolkits.map((toolkit: any) => {
      const curated = curatedMap.get(toolkit.slug);
      const accounts = accountsByToolkit.get(toolkit.slug) ?? [];
      const preferredAccount = pickPreferredAccount(accounts);
      const authConfigId = authConfigMap.get(toolkit.slug);

      // Use curated metadata if available, otherwise fallback to Composio meta
      const category = normalizeCategory(curated?.category || (toolkit.meta?.categories?.[0]?.name as any));
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
        capabilities: curated?.capabilities || [],
        suggestedPrompt: curated?.suggestedPrompt || null,
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
