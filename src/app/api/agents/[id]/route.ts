import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth();

        const { id } = await params;

        const agent = await prisma.agentConfig.findUnique({
            where: { id },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                image: true,
                tokensPerHour: true,
                requiredTier: true,
                defaultModel: true,
                active: true,
                pricePerSession: true,
                isPublic: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!agent) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }

        return NextResponse.json({ agent });
    } catch (error) {
        return handleAuthError(error);
    }
}
