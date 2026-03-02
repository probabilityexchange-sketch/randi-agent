import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

// FIX (HIGH): Added rate limiting to prevent enumeration/scraping.
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anon";
  const { allowed } = await checkRateLimit(`agents-list:${ip}`, RATE_LIMITS.agents);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const includeAll = searchParams.get("all") === "true";

  const specialists = ["research-assistant", "code-assistant", "productivity-agent"];

  const where: any = { active: true };
  if (!includeAll) {
    where.slug = { notIn: specialists };
  }

  const agents = await prisma.agentConfig.findMany({
    where,
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      tokensPerHour: true,
      requiredTier: true,
      active: true,
      image: true,
      internalPort: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ agents });
}
