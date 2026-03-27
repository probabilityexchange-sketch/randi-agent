import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/nodes/[nodeId] - Get a specific bridge node (admin only)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ nodeId: string }> }) {
  try {
    await requireAuth();

    if (!process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { nodeId } = await params;

    const node = await prisma.bridgeNode.findUnique({ where: { nodeId } });
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const { apiKey: _, ...safeNode } = node;
    return NextResponse.json({ node: safeNode });
  } catch (error) {
    return handleAuthError(error);
  }
}

/**
 * PUT /api/nodes/[nodeId] - Update a bridge node (admin only)
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ nodeId: string }> }) {
  try {
    await requireAuth();

    if (!process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { nodeId } = await params;
    const body = await req.json();

    const existing = await prisma.bridgeNode.findUnique({ where: { nodeId } });
    if (!existing) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    let lastHealthcheckAt = existing.lastHealthcheckAt;
    if (body.lastHealthcheckAt !== undefined) {
      const parsed = new Date(body.lastHealthcheckAt);
      if (!isNaN(parsed.getTime())) {
        lastHealthcheckAt = parsed;
      }
    }

    const parsedMax =
      typeof body.maxContainers === 'number' && body.maxContainers > 0 && body.maxContainers <= 1000
        ? body.maxContainers
        : existing.maxContainers;

    const updated = await prisma.bridgeNode.update({
      where: { nodeId },
      data: {
        url: body.url ?? existing.url,
        region: body.region ?? existing.region,
        apiKey: body.apiKey ?? existing.apiKey,
        maxContainers: parsedMax,
        status: body.status ?? existing.status,
        lastHealthcheckAt,
      },
    });

    const { apiKey: _, ...safeUpdated } = updated;
    return NextResponse.json({ node: safeUpdated });
  } catch (error) {
    return handleAuthError(error);
  }
}

/**
 * DELETE /api/nodes/[nodeId] - Remove a bridge node (admin only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    await requireAuth();

    if (!process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { nodeId } = await params;

    const existing = await prisma.bridgeNode.findUnique({ where: { nodeId } });
    if (!existing) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    await prisma.bridgeNode.delete({ where: { nodeId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
