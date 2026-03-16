import { NextRequest, NextResponse } from "next/server";
import { getCreditPacks } from "@/lib/tokenomics";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anon";
  const { allowed } = await checkRateLimit(`credits-packages:${ip}`, RATE_LIMITS.general);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  return NextResponse.json({
    plan: { id: "free", name: "Free Tier", price: 0 },
    packages: getCreditPacks(),
  });
}
