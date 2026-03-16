import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { getApprovalRequestForUser, resolveApprovalRequest } from "@/lib/policy/service";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

const schema = z.object({
    approvalId: z.string().min(1),
    decision: z.enum(["APPROVED", "REJECTED"]),
});

/**
 * POST /api/chat/approve
 * Records the user's decision on a pending tool approval.
 * The ChatWindow will then trigger re-submission of the original message
 * with resumeApprovalId to execute (or skip) the tool and continue the chain.
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth();

        const { allowed } = await checkRateLimit(`chat-approve:${auth.userId}`, RATE_LIMITS.toolApproval);
        if (!allowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const body = await req.json();
        const parsed = schema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0].message },
                { status: 400 }
            );
        }

        const { approvalId, decision } = parsed.data;

        const approvalRequest = await getApprovalRequestForUser(approvalId, auth.userId).catch(() => null);
        if (approvalRequest) {
            if (approvalRequest.status !== "pending") {
                return NextResponse.json(
                    { error: `Approval already ${approvalRequest.status}` },
                    { status: 409 }
                );
            }

            await resolveApprovalRequest({
                approvalRequestId: approvalId,
                userId: auth.userId,
                resolution: decision === "APPROVED" ? "approved" : "rejected",
            });

            return NextResponse.json({ ok: true, decision });
        }

        // Load the legacy tool approval and verify session ownership
        const approval = await prisma.toolApproval.findUnique({
            where: { id: approvalId },
            include: { session: { select: { userId: true } } },
        });

        if (!approval) {
            return NextResponse.json({ error: "Approval not found" }, { status: 404 });
        }

        if (approval.session.userId !== auth.userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (approval.status !== "PENDING") {
            return NextResponse.json(
                { error: `Approval already ${approval.status.toLowerCase()}` },
                { status: 409 }
            );
        }

        // Record the decision
        await prisma.toolApproval.update({
            where: { id: approvalId },
            data: { status: decision },
        });

        return NextResponse.json({ ok: true, decision });
    } catch (error) {
        return handleAuthError(error);
    }
}

/**
 * GET /api/chat/approve?approvalId=xxx
 * Returns current status of an approval. Used by the UI to poll or verify.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth();

        const { allowed } = await checkRateLimit(`chat-approve:${auth.userId}`, RATE_LIMITS.toolApproval);
        if (!allowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const { searchParams } = new URL(req.url);
        const approvalId = searchParams.get("approvalId");

        if (!approvalId) {
            return NextResponse.json({ error: "approvalId required" }, { status: 400 });
        }

        const approvalRequest = await getApprovalRequestForUser(approvalId, auth.userId).catch(() => null);

        if (approvalRequest) {
            return NextResponse.json({
                id: approvalRequest.id,
                toolName: approvalRequest.toolName,
                toolArgs: approvalRequest.toolArgsJson,
                workflowId: approvalRequest.workflowId,
                status: approvalRequest.status,
                summary: approvalRequest.summary,
                createdAt: approvalRequest.createdAt,
                resolvedAt: approvalRequest.resolvedAt,
            });
        }

        const approval = await prisma.toolApproval.findUnique({
            where: { id: approvalId },
            include: { session: { select: { userId: true } } },
        });

        if (!approval || approval.session.userId !== auth.userId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json({
            id: approval.id,
            toolName: approval.toolName,
            toolArgs: approval.toolArgs,
            status: approval.status,
            createdAt: approval.createdAt,
        });
    } catch (error) {
        return handleAuthError(error);
    }
}
