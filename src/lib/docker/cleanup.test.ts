import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    cleanupLock: {
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    container: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/docker/client', () => ({
  docker: {
    listContainers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/lib/compute/bridge-client', () => ({
  getComputeBridge: vi.fn().mockReturnValue(null),
}));

import { cleanupExpiredContainers } from '@/lib/docker/cleanup';
import { prisma } from '@/lib/db/prisma';

const recentLock = { id: 'cleanup-lock', lockedAt: new Date() }; // fresh lock — NOT stale
const staleLock = { id: 'cleanup-lock', lockedAt: new Date(Date.now() - 15 * 60 * 1000) }; // 15 min old — stale

describe('cleanupExpiredContainers — distributed lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acquires lock, runs cleanup, and releases lock on success', async () => {
    vi.mocked(prisma.cleanupLock.create).mockResolvedValue({} as any);
    vi.mocked(prisma.cleanupLock.delete).mockResolvedValue({} as any);
    vi.mocked(prisma.container.findMany).mockResolvedValue([]);

    await cleanupExpiredContainers();

    expect(prisma.cleanupLock.create).toHaveBeenCalledOnce();
    expect(prisma.cleanupLock.delete).toHaveBeenCalledOnce();
  });

  it('skips cleanup when lock is already held by a recent process', async () => {
    vi.mocked(prisma.cleanupLock.create).mockRejectedValue(
      new Error('Unique constraint violation')
    );
    vi.mocked(prisma.cleanupLock.findUnique).mockResolvedValue(recentLock as any);

    await cleanupExpiredContainers();

    expect(prisma.container.findMany).not.toHaveBeenCalled();
    expect(prisma.cleanupLock.delete).not.toHaveBeenCalled();
  });

  it('recovers stale lock and runs cleanup', async () => {
    vi.mocked(prisma.cleanupLock.create)
      .mockRejectedValueOnce(new Error('Unique constraint violation')) // first attempt
      .mockResolvedValueOnce({} as any); // second attempt succeeds after stale delete
    vi.mocked(prisma.cleanupLock.findUnique).mockResolvedValue(staleLock as any);
    vi.mocked(prisma.cleanupLock.delete).mockResolvedValue({} as any);
    vi.mocked(prisma.container.findMany).mockResolvedValue([]);

    await cleanupExpiredContainers();

    expect(prisma.cleanupLock.delete).toHaveBeenCalledTimes(2); // once stale-clear, once release
    expect(prisma.container.findMany).toHaveBeenCalled();
  });

  it('releases lock even when cleanup throws', async () => {
    vi.mocked(prisma.cleanupLock.create).mockResolvedValue({} as any);
    vi.mocked(prisma.cleanupLock.delete).mockResolvedValue({} as any);
    vi.mocked(prisma.container.findMany).mockRejectedValue(new Error('DB down'));

    await expect(cleanupExpiredContainers()).rejects.toThrow('DB down');

    expect(prisma.cleanupLock.delete).toHaveBeenCalledOnce();
  });

  it('marks expiring-soon containers and updates warning timestamp', async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 min from now

    vi.mocked(prisma.cleanupLock.create).mockResolvedValue({} as any);
    vi.mocked(prisma.cleanupLock.delete).mockResolvedValue({} as any);
    vi.mocked(prisma.container.findMany)
      .mockResolvedValueOnce([
        { id: 'ctr-1', subdomain: 'agent-1', dockerId: null },
      ] as any)
      .mockResolvedValueOnce([]); // expired query
    vi.mocked(prisma.container.update).mockResolvedValue({} as any);

    await cleanupExpiredContainers();

    expect(prisma.container.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ctr-1' },
        data: expect.objectContaining({ lastWarningSentAt: expect.any(Date) }),
      })
    );
  });

  it('skips expired cleanup when no expired containers found', async () => {
    vi.mocked(prisma.cleanupLock.create).mockResolvedValue({} as any);
    vi.mocked(prisma.cleanupLock.delete).mockResolvedValue({} as any);
    vi.mocked(prisma.container.findMany)
      .mockResolvedValueOnce([]) // expiring soon
      .mockResolvedValueOnce([]); // expired — empty, should return early

    await cleanupExpiredContainers();

    expect(prisma.container.update).not.toHaveBeenCalled();
  });
});
