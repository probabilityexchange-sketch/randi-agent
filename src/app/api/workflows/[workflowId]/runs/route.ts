import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { createWorkflowRun, listWorkflowRuns } from "@/lib/workflows/service";

const createRunSchema = z.object({
  triggerSource: z.enum(["manual", "api", "schedule", "event", "system"]).default("manual"),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(`workflow-runs:${auth.userId}`, RATE_LIMITS.general);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { workflowId } = await params;
    const runs = await listWorkflowRuns(auth.userId, workflowId);
    return NextResponse.json({ runs });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(`workflow-runs:${auth.userId}`, RATE_LIMITS.general);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { workflowId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = createRunSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const run = await createWorkflowRun({
      userId: auth.userId,
      workflowId,
      triggerSource: parsed.data.triggerSource,
    });

    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKFLOW_NOT_FOUND") {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }
    return handleAuthError(error);
  }
}
