import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: vi.fn(),
  handleAuthError: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    bridgeNode: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { GET, POST } from '@/app/api/nodes/route';
import { requireAuth, handleAuthError } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@/generated/prisma/client';

const makeReq = (method = 'GET', url = 'http://localhost/api/nodes', body?: object) =>
  new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
  });

const authedUser = { id: 'user-1', email: 'admin@test.com' };

describe('GET /api/nodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handleAuthError).mockReturnValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
    process.env.ADMIN_SECRET = 'secret';
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'));
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns 403 when ADMIN_SECRET is not set', async () => {
    vi.mocked(requireAuth).mockResolvedValue(authedUser as any);
    delete process.env.ADMIN_SECRET;
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it('returns all nodes when no filters', async () => {
    vi.mocked(requireAuth).mockResolvedValue(authedUser as any);
    vi.mocked(prisma.bridgeNode.findMany).mockResolvedValue([
      { nodeId: 'node-1', url: 'http://node1', status: 'ACTIVE' },
    ] as any);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nodes).toHaveLength(1);
  });

  it('passes status filter to prisma', async () => {
    vi.mocked(requireAuth).mockResolvedValue(authedUser as any);
    vi.mocked(prisma.bridgeNode.findMany).mockResolvedValue([]);
    await GET(makeReq('GET', 'http://localhost/api/nodes?status=ACTIVE'));
    expect(prisma.bridgeNode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'ACTIVE' }) })
    );
  });
});

describe('POST /api/nodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handleAuthError).mockReturnValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
    process.env.ADMIN_SECRET = 'secret';
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'));
    const res = await POST(makeReq('POST', undefined, { nodeId: 'n1', url: 'http://x', region: 'us', apiKey: 'k' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when ADMIN_SECRET is not set', async () => {
    vi.mocked(requireAuth).mockResolvedValue(authedUser as any);
    delete process.env.ADMIN_SECRET;
    const res = await POST(makeReq('POST', undefined, { nodeId: 'n1', url: 'http://x', region: 'us', apiKey: 'k' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields are missing', async () => {
    vi.mocked(requireAuth).mockResolvedValue(authedUser as any);
    const res = await POST(makeReq('POST', undefined, { nodeId: 'n1' }));
    expect(res.status).toBe(400);
  });

  it('returns 409 when node already exists (P2002 on create)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(authedUser as any);
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint violation', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    vi.mocked(prisma.bridgeNode.create).mockRejectedValue(p2002);
    const res = await POST(makeReq('POST', undefined, { nodeId: 'n1', url: 'http://x', region: 'us', apiKey: 'k' }));
    expect(res.status).toBe(409);
  });

  it('creates node and returns 201 on valid input', async () => {
    vi.mocked(requireAuth).mockResolvedValue(authedUser as any);
    vi.mocked(prisma.bridgeNode.create).mockResolvedValue({
      nodeId: 'n1', url: 'http://x', region: 'us', status: 'ACTIVE', apiKey: 'secret-key',
    } as any);
    const res = await POST(makeReq('POST', undefined, { nodeId: 'n1', url: 'http://x', region: 'us', apiKey: 'k' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.node.nodeId).toBe('n1');
    expect(body.node.apiKey).toBeUndefined();
  });
});
