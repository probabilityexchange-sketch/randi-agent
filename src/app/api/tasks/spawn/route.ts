import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(`task-spawn:${auth.userId}`, RATE_LIMITS.chat);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const { project, task, agent = "claude-code" } = body;

    if (!project || !task) {
      return NextResponse.json({ error: "Project and task are required" }, { status: 400 });
    }

    const bridgeUrl = process.env.COMPUTE_BRIDGE_URL;
    const bridgeKey = process.env.COMPUTE_BRIDGE_API_KEY;

    if (!bridgeUrl || !bridgeKey) {
      return NextResponse.json({ error: "Compute bridge is not configured. Add COMPUTE_BRIDGE_URL and COMPUTE_BRIDGE_API_KEY." }, { status: 500 });
    }

    const response = await fetch(`${bridgeUrl}/spawn-ao`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-api-key": bridgeKey,
      },
      body: JSON.stringify({ project, task, agent }),
    });

    const result = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: result.error || "Bridge request failed" }, { status: response.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Task spawn error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
