import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { workflowPlanSchema } from "@/lib/workflows/schema";
import { listWorkflows, saveWorkflowDraft } from "@/lib/workflows/service";

const createWorkflowSchema = z.object({
  plan: workflowPlanSchema,
  workflowId: z.string().min(1).optional(),
});

export async function GET() {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(`workflows:${auth.userId}`, RATE_LIMITS.general);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const workflows = await listWorkflows(auth.userId);
    return NextResponse.json({ workflows });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(`workflows:${auth.userId}`, RATE_LIMITS.general);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = createWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const workflow = await saveWorkflowDraft({
      userId: auth.userId,
      plan: parsed.data.plan,
      workflowId: parsed.data.workflowId,
    });

    return NextResponse.json({ workflow });
  } catch (error) {
    return handleAuthError(error);
  }
}
