import { prisma } from '@/lib/db/prisma';
import { docker } from '@/lib/docker/client';
import { getComputeBridge } from '@/lib/compute/bridge-client';

const LOCK_ID = 'cleanup-lock';

const LOCK_STALE_MS = 10 * 60 * 1000; // 10 minutes

async function acquireCleanupLock(): Promise<boolean> {
  try {
    await prisma.cleanupLock.create({
      data: { id: LOCK_ID, lockedAt: new Date() },
    });
    return true;
  } catch {
    // Lock already held — check if it's stale (process may have crashed)
    const existing = await prisma.cleanupLock.findUnique({ where: { id: LOCK_ID } });
    if (existing && Date.now() - existing.lockedAt.getTime() > LOCK_STALE_MS) {
      await prisma.cleanupLock.delete({ where: { id: LOCK_ID } }).catch(() => {});
      return acquireCleanupLock();
    }
    return false;
  }
}

async function releaseCleanupLock(): Promise<void> {
  await prisma.cleanupLock.delete({ where: { id: LOCK_ID } }).catch(() => {});
}

export async function cleanupExpiredContainers() {
  const lockAcquired = await acquireCleanupLock();
  if (!lockAcquired) {
    console.log('[Cleanup] Already running in another process, skipping.');
    return;
  }

  try {
    await runCleanup();
  } finally {
    await releaseCleanupLock();
  }
}

async function runCleanup() {
  const now = new Date();
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

  // 1. Identify containers expiring within 15 mins that haven't been warned
  const expiringSoon = await prisma.container.findMany({
    where: {
      status: 'RUNNING',
      expiresAt: {
        gt: now,
        lt: fifteenMinutesFromNow,
      },
      lastWarningSentAt: null,
    },
  });

  for (const container of expiringSoon) {
    console.log(
      `[Grace Period] Marking container ${container.id} (${container.subdomain}) as expiring soon.`
    );
    await prisma.container.update({
      where: { id: container.id },
      data: { lastWarningSentAt: now },
    });
    // Here we could trigger a real notification (email, websocket, etc.)
  }

  // 2. Cleanup containers that have actually expired
  const expired = await prisma.container.findMany({
    where: {
      status: 'RUNNING',
      expiresAt: { lt: now },
    },
  });

  if (expired.length === 0) return;

  for (const container of expired) {
    try {
      let removalSucceeded = !container.dockerId; // no dockerId = nothing to remove
      if (container.dockerId) {
        const bridge = getComputeBridge();
        if (bridge) {
          try {
            await bridge.remove(container.dockerId);
            removalSucceeded = true;
          } catch (e) {
            console.warn(
              `[Cleanup] Bridge removal failed for ${container.dockerId} — will retry next cycle`,
              e
            );
          }
        } else {
          const dockerContainer = docker.getContainer(container.dockerId);
          try {
            await dockerContainer.stop({ t: 10 });
          } catch (e: unknown) {
            const dockerErr = e as { statusCode?: number };
            if (dockerErr.statusCode !== 304 && dockerErr.statusCode !== 404) throw e;
          }
          await dockerContainer.remove({ force: true }).catch(() => {});
          removalSucceeded = true;
        }
      }

      if (removalSucceeded) {
        await prisma.container.update({
          where: { id: container.id },
          data: { status: 'EXPIRED', stoppedAt: now },
        });
      }
    } catch (error) {
      console.error(`Failed to cleanup expired container ${container.id}:`, error);
    }
  }

  // 3. Cleanup orphaned docker containers (managed by us but not in DB)
  const allContainers = await docker.listContainers({
    all: true,
    filters: { label: ['agent-platform.managed=true'] },
  });

  const knownDockerIds = new Set(
    (
      await prisma.container.findMany({
        where: { dockerId: { in: allContainers.map(c => c.Id) } },
        select: { dockerId: true },
      })
    ).map(c => c.dockerId)
  );

  for (const info of allContainers) {
    if (!knownDockerIds.has(info.Id)) {
      console.log(`[Orphan] Removing orphaned container ${info.Id.slice(0, 12)}...`);
      const orphan = docker.getContainer(info.Id);
      try {
        await orphan.stop({ t: 5 });
      } catch {
        // might already be stopped
      }
      await orphan.remove({ force: true }).catch(e => {
        console.warn(`Failed to remove orphaned container ${info.Id.slice(0, 12)}:`, e);
      });
    }
  }
}
