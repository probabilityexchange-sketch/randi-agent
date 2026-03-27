import { docker } from "./client";
import { getAgentConfig } from "./agents";
import { generatePassword } from "@/lib/utils/crypto";
import { generateSubdomain } from "@/lib/utils/subdomain";
import { prisma } from "@/lib/db/prisma";
import { createHash } from "crypto";
import { getBestBridgeNode } from "@/lib/compute/bridge-client";

const DOCKER_NETWORK = process.env.DOCKER_NETWORK || "traefik-net";

export interface ProvisionResult {
  dockerId: string;
  subdomain: string;
  url: string;
  password: string | null;
}

interface DockerErrorLike {
  statusCode?: number;
  reason?: string;
  message?: string;
  json?: { message?: string };
}

export class ProvisioningError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ProvisioningError";
    this.code = code;
  }
}

function extractDockerErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const dockerError = error as DockerErrorLike;
    if (typeof dockerError.reason === "string" && dockerError.reason.length > 0) {
      return dockerError.reason;
    }
    if (typeof dockerError.json?.message === "string" && dockerError.json.message.length > 0) {
      return dockerError.json.message;
    }
    if (typeof dockerError.message === "string" && dockerError.message.length > 0) {
      return dockerError.message;
    }
  }

  return "Unknown Docker error";
}

function isDockerNotFound(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    const dockerError = error as DockerErrorLike;
    return dockerError.statusCode === 404;
  }
  return false;
}

async function ensureNetworkExists(networkName: string): Promise<void> {
  try {
    await docker.getNetwork(networkName).inspect();
  } catch (error) {
    if (isDockerNotFound(error)) {
      throw new ProvisioningError(
        "DOCKER_NETWORK_NOT_FOUND",
        `Docker network '${networkName}' does not exist`
      );
    }

    throw new ProvisioningError(
      "DOCKER_NETWORK_CHECK_FAILED",
      `Unable to inspect Docker network '${networkName}': ${extractDockerErrorMessage(error)}`
    );
  }
}

async function pullImage(image: string): Promise<void> {
  let stream: NodeJS.ReadableStream;
  try {
    stream = await docker.pull(image);
  } catch (error) {
    throw new ProvisioningError(
      "DOCKER_IMAGE_PULL_FAILED",
      `Unable to pull image '${image}': ${extractDockerErrorMessage(error)}`
    );
  }

  await new Promise<void>((resolve, reject) => {
    const dockerWithModem = docker as unknown as {
      modem?: {
        followProgress?: (
          pullStream: NodeJS.ReadableStream,
          onFinished: (error: Error | null) => void
        ) => void;
      };
    };

    if (!dockerWithModem.modem?.followProgress) {
      reject(new Error("Docker client modem is unavailable for pull progress"));
      return;
    }

    dockerWithModem.modem.followProgress(stream, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  }).catch((error: unknown) => {
    throw new ProvisioningError(
      "DOCKER_IMAGE_PULL_FAILED",
      `Image pull did not complete for '${image}': ${extractDockerErrorMessage(error)}`
    );
  });
}

async function ensureImageAvailable(image: string): Promise<void> {
  try {
    await docker.getImage(image).inspect();
    return;
  } catch (error) {
    if (!isDockerNotFound(error)) {
      throw new ProvisioningError(
        "DOCKER_IMAGE_CHECK_FAILED",
        `Unable to inspect image '${image}': ${extractDockerErrorMessage(error)}`
      );
    }
  }

  await pullImage(image);
}

function buildStorageKey(userId: string, agentSlug: string): string {
  const hash = createHash("sha256")
    .update(`${userId}:${agentSlug}`)
    .digest("hex")
    .slice(0, 16);
  return `${agentSlug}-${hash}`;
}

export async function provisionContainer(
  userId: string,
  agentSlug: string,
  username: string,
  tier: string = "FREE",
  snapshotUrl?: string
): Promise<ProvisionResult> {
  const bridge = await getBestBridgeNode();
  if (bridge) {
    console.log(`[Compute] Provisioning on bridge node: ${bridge.getNodeId() || bridge.getBaseUrl()}`);
    return bridge.provision(userId, agentSlug, username, tier, snapshotUrl);
  }

  const agentConfigFactory = getAgentConfig(agentSlug);
  if (!agentConfigFactory) {
    throw new ProvisioningError(
      "AGENT_CONFIG_NOT_FOUND",
      `No runtime agent configuration found for slug '${agentSlug}'`
    );
  }

  const agent = await prisma.agentConfig.findUnique({
    where: { slug: agentSlug },
  });
  if (!agent || !agent.active) {
    throw new ProvisioningError(
      "AGENT_NOT_AVAILABLE",
      `Agent '${agentSlug}' is not active`
    );
  }

  const domain = process.env.NEXT_PUBLIC_DOMAIN || "localhost";
  const subdomain = generateSubdomain(username, agentSlug);
  const password = generatePassword();
  const persistentStorageEnabled =
    process.env.AGENT_PERSISTENT_STORAGE !== "false";
  const storageKey = persistentStorageEnabled
    ? buildStorageKey(userId, agentSlug)
    : subdomain;

  const config = agentConfigFactory({ subdomain, password, domain, storageKey });

  const fullSubdomain = `${subdomain}.${domain}`;
  const containerName = `ap-${subdomain}`;

  await ensureNetworkExists(DOCKER_NETWORK);
  await ensureImageAvailable(config.image);

  // Build volume binds
  const binds: string[] = Object.entries(config.volumes).map(
    ([volumeName, containerPath]) => `${volumeName}:${containerPath}`
  );

  // Build environment array
  const envArray = Object.entries(config.env).map(
    ([key, value]) => `${key}=${value}`
  );

  // Scale resources based on tier
  const tierValue = tier.toUpperCase();
  const resourceMultiplier = tierValue === "PRO" ? 2 : 1;

  const memoryLimit = BigInt(config.memoryLimit) * BigInt(resourceMultiplier);
  const nanoCpus = Number(config.cpuLimit) * resourceMultiplier;

  let container;
  try {
    container = await docker.createContainer({
      Image: config.image,
      name: containerName,
      Env: envArray,
      ExposedPorts: {
        [`${config.internalPort}/tcp`]: {},
      },
      HostConfig: {
        Binds: binds,
        Memory: Number(memoryLimit),
        NanoCpus: nanoCpus,
        PidsLimit: config.pidLimit,
        CapDrop: ["ALL"],
        CapAdd: ["NET_BIND_SERVICE"],
        SecurityOpt: ["no-new-privileges"],
        Privileged: false,
        NetworkMode: DOCKER_NETWORK,
      },
      Labels: {
        "traefik.enable": "true",
        [`traefik.http.routers.${containerName}.rule`]: `Host(\`${fullSubdomain}\`)`,
        [`traefik.http.routers.${containerName}.entrypoints`]: "websecure",
        [`traefik.http.routers.${containerName}.tls.certresolver`]: "letsencrypt",
        [`traefik.http.services.${containerName}.loadbalancer.server.port`]:
          String(config.internalPort),
        "agent-platform.managed": "true",
        "agent-platform.user-id": userId,
        "agent-platform.agent-slug": agentSlug,
      },
    });
  } catch (error) {
    throw new ProvisioningError(
      "DOCKER_CONTAINER_CREATE_FAILED",
      `Unable to create container '${containerName}': ${extractDockerErrorMessage(error)}`
    );
  }

  try {
    await container.start();

    return {
      dockerId: container.id,
      subdomain,
      url: `https://${fullSubdomain}`,
      password: agentSlug === "openclaw" ? password : null,
    };
  } catch (error) {
    // Cleanup if start fails
    await container.remove({ force: true }).catch(() => { });
    throw new ProvisioningError(
      "DOCKER_CONTAINER_START_FAILED",
      `Container '${containerName}' failed to start: ${extractDockerErrorMessage(error)}`
    );
  }
}
