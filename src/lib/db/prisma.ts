import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const bigIntPrototype = BigInt.prototype as bigint & {
  toJSON?: () => string;
};

bigIntPrototype.toJSON = function () {
  return this.toString();
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const DB_PROTOCOL = /^(?:postgres(?:ql)?|file):\/\//i;

function normalizedEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value) return null;
  return DB_PROTOCOL.test(value) ? value : null;
}

function isSupabasePooler(url: string): boolean {
  return url.includes("pooler.supabase.com");
}

function isSupabaseDirect(url: string): boolean {
  return url.includes(".supabase.co:5432");
}

function deriveSupabaseProjectRef(): string | null {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) return null;
  try {
    const host = new URL(supabaseUrl).hostname;
    const first = host.split(".")[0]?.trim();
    return first || null;
  } catch {
    return null;
  }
}

function patchSupabaseConnection(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const passwordFromEnv = process.env.POSTGRES_PASSWORD?.trim();
  if (!parsed.password && passwordFromEnv) {
    parsed.password = passwordFromEnv;
  }

  const isPooler = parsed.hostname.includes("pooler.supabase.com");
  if (isPooler) {
    const projectRef = deriveSupabaseProjectRef();
    const username = parsed.username;
    if (projectRef && username === "postgres") {
      parsed.username = `postgres.${projectRef}`;
    }

    const params = parsed.searchParams;
    if (!params.has("sslmode")) {
      params.set("sslmode", "require");
    }
    if (!params.has("pgbouncer")) {
      params.set("pgbouncer", "true");
    }
    if (!params.has("connection_limit")) {
      params.set("connection_limit", "10");
    }
  }

  return parsed.toString();
}

function selectDatabaseUrl(): { url: string | null; source: string | null } {
  const managedFirst =
    process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production";
  const orderedNames = managedFirst
    ? [
      "POSTGRES_PRISMA_URL",
      "POSTGRES_URL",
      "DATABASE_URL",
      "DIRECT_URL",
      "POSTGRES_URL_NON_POOLING",
    ]
    : [
      "DATABASE_URL",
      "POSTGRES_PRISMA_URL",
      "POSTGRES_URL",
      "DIRECT_URL",
      "POSTGRES_URL_NON_POOLING",
    ];

  const candidates = orderedNames.map((name) => {
    const raw = normalizedEnv(name);
    return [name, raw ? patchSupabaseConnection(raw) : null] as const;
  });

  const valid = candidates.filter(([, value]) => Boolean(value)) as ReadonlyArray<
    readonly [string, string]
  >;

  const preferredPooler = valid.find(([, value]) => isSupabasePooler(value));
  if (preferredPooler) {
    return { source: preferredPooler[0], url: preferredPooler[1] };
  }

  const nonDirect = valid.find(([, value]) => !isSupabaseDirect(value));
  if (nonDirect) {
    return { source: nonDirect[0], url: nonDirect[1] };
  }

  return valid[0]
    ? { source: valid[0][0], url: valid[0][1] }
    : { source: null, url: null };
}

const selected = selectDatabaseUrl();
if (selected.url) {
  process.env.DATABASE_URL = selected.url;
}

function createPrismaClient(): PrismaClient {
  if (!selected.url) {
    throw new Error("DATABASE_URL is not configured for Prisma.");
  }

  if (process.env.NODE_ENV !== "test") {
    const safeHost = (() => {
      try {
        return new URL(selected.url).host;
      } catch {
        return "invalid";
      }
    })();
    console.log("Prisma datasource selection details:", {
      source: selected.source,
      host: safeHost,
      projectRef: deriveSupabaseProjectRef(),
      env: process.env.VERCEL_ENV || "unknown",
    });
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: selected.url,
    }),
  });
}

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
