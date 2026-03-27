import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@/generated/prisma/client';

/**
 * GET /api/nodes - List all bridge nodes (admin only)
 * Query params:
 * - status: Filter by status (ACTIVE, INACTIVE, DEGRADED)
 * - region: Filter by region
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    if (!process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const region = searchParams.get('region');

    const where: Record<string, string> = {};
    if (status) where.status = status;
    if (region) where.region = region;

    const nodes = await prisma.bridgeNode.findMany({
      where,
      orderBy: { nodeId: 'asc' },
      select: {
        id: true,
        nodeId: true,
        url: true,
        region: true,
        status: true,
        maxContainers: true,
        lastHealthcheckAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ nodes });
  } catch (error) {
    return handleAuthError(error);
  }
}

/**
 * POST /api/nodes - Register a new bridge node (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    if (!process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { nodeId, url, region, apiKey, maxContainers } = body;

    if (!nodeId || !url || !region || !apiKey) {
      return NextResponse.json(
        { error: 'nodeId, url, region, and apiKey are required' },
        { status: 400 }
      );
    }

    const parsedMax =
      typeof maxContainers === 'number' && maxContainers > 0 && maxContainers <= 1000
        ? maxContainers
        : 50;

    const node = await prisma.bridgeNode.create({
      data: { nodeId, url, region, apiKey, maxContainers: parsedMax, status: 'ACTIVE' },
    });

    const { apiKey: _, ...safeNode } = node;
    return NextResponse.json({ node: safeNode }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Node already registered' }, { status: 409 });
    }
    return handleAuthError(err);
  }
}
