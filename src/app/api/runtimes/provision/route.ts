import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, agentId, sessionId } = body;

        // Require internal secret — fail closed if env var is not configured
        const secret = req.headers.get("x-internal-auth");
        if (!process.env.INTERNAL_API_SECRET || secret !== process.env.INTERNAL_API_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // --- PROVISIONER ABSTRACTION BOUNDARY ---
        // This is where you'd call ECS, Docker, Fly.io, or your own bridge.
        // For now, we simulate a 'not configured' error to test the UI's resilience.

        const requestId = `prov_${Date.now()}`;
        const error = {
            request_id: requestId,
            status_code: 501,
            error_category: "config",
            message: "Provisioner not configured yet. Falling back to shared runtime."
        };

        // Update the agent runtime state in DB to failed
        await prisma.agentRuntime.upsert({
            where: {
                userId_agentId: {
                    userId,
                    agentId
                }
            },
            update: {
                state: "failed",
                lastErrorRequestId: requestId,
                lastErrorCategory: "config",
                lastErrorStatusCode: 501,
                lastErrorMessage: error.message,
                updatedAt: new Date()
            },
            create: {
                userId,
                agentId,
                state: "failed",
                lastErrorRequestId: requestId,
                lastErrorCategory: "config",
                lastErrorStatusCode: 501,
                lastErrorMessage: error.message
            }
        });

        // Ensure the chat session remains targeting 'shared' (it defaults to shared anyway, but good to be explicit)
        if (sessionId) {
            await prisma.chatSession.update({
                where: { id: sessionId },
                data: {
                    runtimeTarget: "shared",
                    updatedAt: new Date()
                }
            });
        }

        return NextResponse.json({
            success: false,
            error
        }, { status: 501 });

    } catch (err) {
        console.error("Provisioner stub error:", err);
        return NextResponse.json({ error: "Internal provisioner error" }, { status: 500 });
    }
}
