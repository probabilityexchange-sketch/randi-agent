import { prisma } from '@/lib/db/prisma';
import { ProvisionResult } from '@/lib/docker/provisioner';

export interface BridgeConfig {
  baseUrl: string;
  apiKey: string;
  nodeId?: string;
}

export class ComputeBridgeClient {
  private config: BridgeConfig;

  constructor(config: BridgeConfig) {
    this.config = config;
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  getNodeId(): string | undefined {
    return this.config.nodeId;
  }

  async provision(
    userId: string,
    agentSlug: string,
    username: string,
    tier: string = 'FREE',
    snapshotUrl?: string
  ): Promise<ProvisionResult> {
    const res = await fetch(`${this.config.baseUrl}/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-API-Key': this.config.apiKey,
      },
      body: JSON.stringify({ userId, agentSlug, username, tier, snapshotUrl }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Bridge provisioning failed');
    }

    return res.json();
  }

  /**
   * Sends a pre-warming signal to the bridge to start fetching a snapshot.
   * This mitigates Cold Start latency by pre-fetching large tars before provisioning.
   */
  async prewarm(snapshotUrl: string, storageKey: string): Promise<void> {
    try {
      await fetch(`${this.config.baseUrl}/prewarm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bridge-API-Key': this.config.apiKey,
        },
        body: JSON.stringify({ snapshotUrl, storageKey }),
      });
    } catch (err) {
      console.warn(
        `[Compute] Prewarm failed for node ${this.config.nodeId || this.config.baseUrl}`,
        err
      );
    }
  }

  async stop(dockerId: string): Promise<void> {
    const res = await fetch(`${this.config.baseUrl}/containers/${dockerId}/stop`, {
      method: 'POST',
      headers: {
        'X-Bridge-API-Key': this.config.apiKey,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Bridge failed to stop container');
    }
  }

  async remove(dockerId: string): Promise<void> {
    const res = await fetch(`${this.config.baseUrl}/containers/${dockerId}`, {
      method: 'DELETE',
      headers: {
        'X-Bridge-API-Key': this.config.apiKey,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Bridge failed to remove container');
    }
  }

  async start(dockerId: string): Promise<void> {
    const res = await fetch(`${this.config.baseUrl}/containers/${dockerId}/start`, {
      method: 'POST',
      headers: {
        'X-Bridge-API-Key': this.config.apiKey,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Bridge failed to start container');
    }
  }

  async pause(dockerId: string): Promise<void> {
    const res = await fetch(`${this.config.baseUrl}/containers/${dockerId}/pause`, {
      method: 'POST',
      headers: {
        'X-Bridge-API-Key': this.config.apiKey,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Bridge failed to pause container');
    }
  }

  async inspect(dockerId: string): Promise<any> {
    const res = await fetch(`${this.config.baseUrl}/containers/${dockerId}/inspect`, {
      method: 'GET',
      headers: {
        'X-Bridge-API-Key': this.config.apiKey,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Bridge failed to inspect container');
    }

    return res.json();
  }

  async getStats(dockerId: string): Promise<{
    cpuPercent: number;
    memoryMb: number;
    memoryLimitMb: number;
  }> {
    const res = await fetch(`${this.config.baseUrl}/containers/${dockerId}/stats`, {
      method: 'GET',
      headers: {
        'X-Bridge-API-Key': this.config.apiKey,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Bridge failed to get stats');
    }

    return res.json();
  }
}

/**
 * Resolves the best bridge node based on FleetStats.
 * Logic: Find the node with the fewest containers reported in the last 2 minutes.
 * Fallback: process.env.COMPUTE_BRIDGE_URL
 */
export async function getBestBridgeNode(): Promise<ComputeBridgeClient | null> {
  const apiKey = process.env.COMPUTE_BRIDGE_API_KEY;
  if (!apiKey) return null;

  try {
    // Look for nodes that reported in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const stats = await prisma.fleetStats.findMany({
      where: { reportedAt: { gte: fiveMinutesAgo } },
      orderBy: { reportedAt: 'desc' },
    });

    // Deduplicate to get latest per node
    const seen = new Set<string>();
    const latestStats = stats.filter(s => {
      if (seen.has(s.nodeId)) return false;
      seen.add(s.nodeId);
      return true;
    });

    if (latestStats.length > 0) {
      // Resolve registry entries for all candidate nodes in one batch
      const nodeIds = latestStats.map(s => s.nodeId);
      const registryNodes = await prisma.bridgeNode.findMany({
        where: { nodeId: { in: nodeIds }, status: 'ACTIVE' },
      });
      const registryMap = new Map(registryNodes.map(n => [n.nodeId, n]));

      // Pick node with least containers, skipping nodes at or over capacity
      const eligible = latestStats.filter(s => {
        const reg = registryMap.get(s.nodeId);
        if (reg && s.totalContainers >= reg.maxContainers) return false;
        return true;
      });

      const candidates = eligible.length > 0 ? eligible : latestStats;
      const best = candidates.reduce((prev, curr) =>
        curr.totalContainers < prev.totalContainers ? curr : prev
      );

      // Resolve nodeId -> URL via NodeRegistry (BridgeNode table)
      const registryNode = registryMap.get(best.nodeId);

      if (registryNode) {
        return new ComputeBridgeClient({
          baseUrl: registryNode.url,
          apiKey: registryNode.apiKey || apiKey,
          nodeId: best.nodeId,
        });
      }

      // Fallback: if nodeId is a direct URL, use it directly
      // TODO: Remove this fallback once all nodes are registered in the NodeRegistry (BridgeNode table) — it bypasses the registry entirely
      if (best.nodeId.startsWith('http')) {
        return new ComputeBridgeClient({ baseUrl: best.nodeId, apiKey, nodeId: best.nodeId });
      }

      // Final fallback: use default env var
      const baseUrl = process.env.COMPUTE_BRIDGE_URL;
      if (baseUrl) {
        return new ComputeBridgeClient({ baseUrl, apiKey, nodeId: best.nodeId });
      }
    }
  } catch (err) {
    console.error('Failed to resolve best bridge node:', err);
  }

  // Ultimate fallback
  const defaultUrl = process.env.COMPUTE_BRIDGE_URL;
  if (!defaultUrl) return null;
  return new ComputeBridgeClient({ baseUrl: defaultUrl, apiKey });
}

let bridgeClient: ComputeBridgeClient | null = null;

export function getComputeBridge(): ComputeBridgeClient | null {
  if (bridgeClient) return bridgeClient;

  const baseUrl = process.env.COMPUTE_BRIDGE_URL;
  const apiKey = process.env.COMPUTE_BRIDGE_API_KEY;

  if (!baseUrl || !apiKey) {
    return null;
  }

  bridgeClient = new ComputeBridgeClient({ baseUrl, apiKey });
  return bridgeClient;
}
