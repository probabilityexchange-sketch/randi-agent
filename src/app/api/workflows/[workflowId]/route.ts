import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { getWorkflowById, listWorkflowRuns } from "@/lib/workflows/service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(`workflows:${auth.userId}`, RATE_LIMITS.general);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { workflowId } = await params;
    const { searchParams } = new URL(req.url);
    const includeRuns = searchParams.get("includeRuns") === "true";

    const workflow = await getWorkflowById(auth.userId, workflowId);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const runs = includeRuns ? await listWorkflowRuns(auth.userId, workflowId) : undefined;
    return NextResponse.json({ workflow, runs });
  } catch (error) {
    return handleAuthError(error);
  }
}
