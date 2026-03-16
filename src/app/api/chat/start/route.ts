import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth();

        const { allowed } = await checkRateLimit(`chat-start:${auth.userId}`, RATE_LIMITS.chat);
        if (!allowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const { agentId = 'randi-lead', preferDedicated = false } = await req.json();

        // 1. Resolve agent
        const agent = await prisma.agentConfig.findFirst({
            where: {
                OR: [
                    { id: agentId },
                    { slug: agentId }
                ],
                active: true
            }
        });

        if (!agent) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }

        // 2. Create chat session immediately (shared by default)
        const session = await prisma.chatSession.create({
            data: {
                userId: auth.userId,
                agentId: agent.id,
                title: "New Chat",
                runtimeTarget: "shared",
            },
            include: {
                agent: {
                    select: { name: true, slug: true }
                }
            }
        });

        // 3. Handle provisioning asynchronously if requested
        if (preferDedicated) {
            // Trigger background provisioning logic
            // This will involve calling /api/runtimes/provision internally or triggering a workflow
            // Note: We don't wait for this.

            // For now, we update the runtime state to 'starting'
            await prisma.agentRuntime.upsert({
                where: {
                    userId_agentId: {
                        userId: auth.userId,
                        agentId: agent.id
                    }
                },
                update: {
                    state: "starting",
                    updatedAt: new Date()
                },
                create: {
                    userId: auth.userId,
                    agentId: agent.id,
                    state: "starting"
                }
            });

            // Internal fetch call (fire and forget in Next.js background or a separate worker)
            // Since Vercel has execution limits, we might want to use a background pattern.
            // For this implementation, we'll just start the call and not await it here.
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://${req.headers.get('host')}`;

            // We'll call /api/runtimes/provision in the background
            // In a real production app, this would be an edge function or a queue
            fetch(`${baseUrl}/api/runtimes/provision`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-auth': process.env.INTERNAL_API_SECRET || 'dev-secret'
                },
                body: JSON.stringify({
                    userId: auth.userId,
                    agentId: agent.id,
                    sessionId: session.id
                })
            }).catch(err => console.error("Background provisioning failed:", err));
        }

        return NextResponse.json({
            session,
            runtimeStatus: preferDedicated ? "starting" : "shared"
        });
    } catch (error) {
        return handleAuthError(error);
    }
}
