const express = require('express');
const Docker = require('dockerode');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const fs = require('fs');
const { Writable } = require('stream');
const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

app.use(express.json());

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
if (!BRIDGE_API_KEY) {
    console.error("CRITICAL: BRIDGE_API_KEY environment variable is not set!");
    process.exit(1);
}

const DOCKER_NETWORK = process.env.DOCKER_NETWORK || "traefik-net";

// --- AGENT REGISTRY (Synchronized with main platform) ---
const agentZeroConfig = (opts) => ({
    image: "frankenstien.azurecr.io/agent-zero:latest",
    internalPort: 8000,
    env: {
        AGENT_PASSWORD: opts.password,
        SUBDOMAIN: opts.subdomain,
        DOMAIN: opts.domain
    },
    volumes: {
        [`ap-storage-${opts.storageKey}`]: "/app/storage"
    },
    memoryLimit: 2 * 1024 * 1024 * 1024,
    cpuLimit: 2000000000,
    pidLimit: 100
});

const openClawConfig = (opts) => ({
    image: "frankenstien.azurecr.io/openclaw:latest",
    internalPort: 5000,
    env: {
        PASSWORD: opts.password
    },
    volumes: {
        [`ap-storage-${opts.storageKey}`]: "/app/data"
    },
    memoryLimit: 1024 * 1024 * 1024,
    cpuLimit: 1000000000,
    pidLimit: 50
});

const agentRegistry = {
    "agent-zero": agentZeroConfig,
    "openclaw": openClawConfig,
    "research-assistant": agentZeroConfig,
    "code-assistant": agentZeroConfig,
    "productivity-agent": agentZeroConfig
};

// --- UTILS ---
function generatePassword() {
    return crypto.randomBytes(16).toString('hex');
}

function generateSubdomain(username, agentSlug) {
    const sanitized = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const suffix = crypto.randomBytes(2).toString('hex');
    return `${sanitized}-${agentSlug}-${suffix}`;
}

const auth = (req, res, next) => {
    if (req.headers['x-bridge-api-key'] !== BRIDGE_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// --- STORAGE HELPERS ---

/**
 * Downloads a URL to a buffer.
 */
function downloadToBuffer(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Restores a .tar.gz snapshot into a Docker volume before the container starts.
 * Uses a temporary busybox container to extract the archive.
 */
async function restoreSnapshotToVolume(volumeName, snapshotUrl) {
    console.log(`[Storage] Restoring snapshot into volume ${volumeName}...`);
    try {
        const tarBuffer = await downloadToBuffer(snapshotUrl);

        // Run a temporary busybox container to extract the archive into the volume
        const helperContainer = await docker.createContainer({
            Image: 'busybox',
            Cmd: ['tar', 'xzf', '/snapshot.tar.gz', '-C', '/data'],
            HostConfig: {
                Binds: [`${volumeName}:/data`],
                AutoRemove: true,
            },
            AttachStdin: true,
            StdinOnce: true,
            OpenStdin: true,
        });

        const stream = await helperContainer.attach({ stream: true, stdin: true, stdout: true, stderr: true });
        await helperContainer.start();

        // Write the tar buffer to stdin and close
        stream.write(tarBuffer);
        stream.end();

        await helperContainer.wait();
        console.log(`[Storage] Snapshot restored to volume ${volumeName}.`);
    } catch (err) {
        console.error(`[Storage] Failed to restore snapshot:`, err.message);
        // Non-fatal: proceed without snapshot
    }
}

/**
 * Tarballs a Docker volume and uploads via a Supabase signed URL.
 * Notifies the platform via PUT /api/storage/snapshot on success.
 */
async function snapshotVolumeAndUpload(volumeName, userId, agentSlug, storageKey) {
    const platformUrl = process.env.PLATFORM_URL;
    const bridgeApiKey = process.env.BRIDGE_API_KEY;
    if (!platformUrl) {
        console.log('[Storage] PLATFORM_URL not set, skipping snapshot.');
        return;
    }

    try {
        // 1. Get a signed upload URL from the platform
        const uploadUrlRes = await fetch(`${platformUrl}/api/storage/snapshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-bridge-api-key': bridgeApiKey },
            // Use internal PUT route which accepts bridge api key
            body: JSON.stringify({ storageKey, userId, agentSlug, action: 'upload-url', sizeBytes: 0 }),
        });
        if (!uploadUrlRes.ok) {
            console.error('[Storage] Failed to get upload URL from platform.');
            return;
        }
        const { signedUrl } = await uploadUrlRes.json();

        // 2. Tarball the volume using a helper container
        const helperContainer = await docker.createContainer({
            Image: 'busybox',
            Cmd: ['tar', 'czf', '-', '-C', '/data', '.'],
            HostConfig: { Binds: [`${volumeName}:/data:ro`] },
            AttachStdout: true,
        });

        const tarStream = await helperContainer.attach({ stream: true, stdout: true });
        await helperContainer.start();

        const chunks = [];
        await new Promise((resolve, reject) => {
            tarStream.on('data', (chunk) => chunks.push(chunk));
            tarStream.on('end', resolve);
            tarStream.on('error', reject);
        });
        await helperContainer.wait();
        await helperContainer.remove({ force: true }).catch(() => { });

        const tarBuffer = Buffer.concat(chunks);

        // 3. Upload to Supabase Storage via signed URL
        const uploadRes = await fetch(signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/gzip', 'Content-Length': tarBuffer.length },
            body: tarBuffer,
        });

        if (!uploadRes.ok) {
            console.error('[Storage] Supabase upload failed:', await uploadRes.text());
            return;
        }

        // 4. Notify platform to record the snapshot metadata
        await fetch(`${platformUrl}/api/storage/snapshot`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-bridge-api-key': bridgeApiKey },
            body: JSON.stringify({ storageKey, userId, agentSlug, sizeBytes: tarBuffer.length }),
        });

        console.log(`[Storage] Snapshot uploaded for volume ${volumeName} (${tarBuffer.length} bytes).`);
    } catch (err) {
        console.error('[Storage] Snapshot upload failed:', err.message);
    }
}

// --- ROUTES ---

app.post('/provision', auth, async (req, res) => {
    const { userId, agentSlug, username, tier = 'FREE', snapshotUrl } = req.body;
    const configFactory = agentRegistry[agentSlug];

    if (!configFactory) {
        return res.status(400).json({ error: 'Invalid agent slug' });
    }

    const domain = process.env.PUBLIC_DOMAIN || "randi.chat";
    const password = generatePassword();
    const subdomain = generateSubdomain(username, agentSlug);
    const storageKey = crypto.createHash('sha256').update(`${userId}:${agentSlug}`).digest('hex').slice(0, 16);

    const config = configFactory({ subdomain, password, domain, storageKey });
    const fullSubdomain = `${subdomain}.${domain}`;
    const containerName = `ap-${subdomain}`;

    // Apply tier multipliers
    const tierValue = tier.toUpperCase();
    const multiplier = tierValue === 'PRO' ? 2 : 1;
    const memoryLimit = config.memoryLimit * multiplier;
    const cpuLimit = config.cpuLimit * multiplier;

    try {
        // 1. Pull Image
        console.log(`Pulling image ${config.image}...`);
        const stream = await docker.pull(config.image);
        await new Promise((resolve, reject) => {
            docker.modem.followProgress(stream, (err, resp) => err ? reject(err) : resolve(resp));
        });

        // 2. Restore snapshot (if available) into the named volume before container start
        const volumeName = Object.keys(config.volumes)[0]; // e.g. ap-storage-{storageKey}
        if (snapshotUrl && volumeName) {
            await restoreSnapshotToVolume(volumeName, snapshotUrl);
        }

        // 3. Create Container
        console.log(`Creating container ${containerName} for user ${userId} [Tier: ${tierValue}]...`);
        const container = await docker.createContainer({
            Image: config.image,
            name: containerName,
            Env: Object.entries(config.env).map(([k, v]) => `${k}=${v}`),
            ExposedPorts: { [`${config.internalPort}/tcp`]: {} },
            HostConfig: {
                Binds: Object.entries(config.volumes).map(([v, p]) => `${v}:${p}`),
                Memory: memoryLimit,
                NanoCpus: cpuLimit,
                PidsLimit: config.pidLimit,
                NetworkMode: DOCKER_NETWORK
            },
            Labels: {
                "traefik.enable": "true",
                [`traefik.http.routers.${containerName}.rule`]: `Host(\`${fullSubdomain}\`)`,
                [`traefik.http.routers.${containerName}.entrypoints`]: "websecure",
                [`traefik.http.routers.${containerName}.tls.certresolver`]: "letsencrypt",
                [`traefik.http.services.${containerName}.loadbalancer.server.port`]: String(config.internalPort),
                "agent-platform.managed": "true",
                "agent-platform.user-id": userId,
                "agent-platform.tier": tierValue
            }
        });

        // 3. Start Container
        await container.start();

        res.json({
            dockerId: container.id,
            subdomain,
            url: `https://${fullSubdomain}`,
            password: agentSlug === "openclaw" ? password : null
        });
    } catch (err) {
        console.error("Provisioning failed:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/containers/:id/start', auth, async (req, res) => {
    try {
        await docker.getContainer(req.params.id).start();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/containers/:id/stop', auth, async (req, res) => {
    try {
        await docker.getContainer(req.params.id).stop({ t: 10 });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/containers/:id', auth, async (req, res) => {
    const { userId, agentSlug, storageKey } = req.query; // optional snapshot params
    try {
        const container = docker.getContainer(req.params.id);
        // Snapshot the volume before removal if metadata is provided
        if (userId && agentSlug && storageKey) {
            // Determine volume name from container labels
            const info = await container.inspect().catch(() => null);
            const binds = info?.HostConfig?.Binds || [];
            const volumeBind = binds.find((b) => b.includes('ap-storage'));
            const volumeName = volumeBind ? volumeBind.split(':')[0] : null;
            if (volumeName) {
                await snapshotVolumeAndUpload(volumeName, userId, agentSlug, storageKey);
            }
        }
        await container.remove({ force: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/containers/:id/inspect', auth, async (req, res) => {
    try {
        const data = await docker.getContainer(req.params.id).inspect();
        res.json(data);
    } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }); }
});

// --- AGENT ORCHESTRATOR INTEGRATION ---
app.post('/spawn-ao', auth, async (req, res) => {
    const { project, task, agent = 'claude-code' } = req.body;

    if (!project) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    // Sanitize project name: alphanumerics and dashes only
    if (!/^[a-z0-9-]+$/i.test(project)) {
        return res.status(400).json({ error: 'Invalid project name. Only alphanumerics and dashes allowed.' });
    }

    try {
        const { spawn } = require('child_process');
        const aoPath = process.env.AO_PATH || '~/agent-orchestrator';

        console.log(`[AO] Spawning ao for project: ${project}`);

        const child = spawn('bash', ['-c', `cd ${aoPath} && AIDER_MODEL="openrouter/meta-llama/llama-3.3-70b-instruct:free" ao spawn ${project}`], {
            detached: true,
            stdio: 'ignore',
            shell: false
        });

        child.unref();

        // We return immediately because 'ao spawn' starts a session that continues in the background
        res.json({
            success: true,
            message: `Orchestrator session requested for project: ${project}`,
            dashboardUrl: `http://${req.hostname}:3000`
        });
    } catch (err) {
        console.error("[AO] Spawn failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- BROWSER INTERACTION (vercel-labs/agent-browser) ---
app.post('/browse', auth, async (req, res) => {
    const { url, action = 'snapshot', selector, text, wait } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const { execSync } = require('child_process');
        
        let command = `agent-browser ${action} "${url}"`;
        if (selector) command += ` --selector "${selector}"`;
        if (text) command += ` --text "${text}"`;
        if (wait) command += ` --wait ${wait}`;

        console.log(`[Browser] Executing: ${command}`);
        
        // Execute synchronously for simple request-response. 
        // We set a 30s timeout to prevent hanging.
        const output = execSync(command, { 
            encoding: 'utf8', 
            timeout: 30000,
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large snapshots
        });

        res.json({ 
            success: true, 
            url, 
            action, 
            output 
        });
    } catch (err) {
        console.error("[Browser] Execution failed:", err.message);
        
        const isNotFound = err.message.includes("not found") || err.message.includes("command not found");
        
        res.status(500).json({ 
            error: isNotFound 
                ? "agent-browser CLI not found on host. Run 'npm install -g @vercel/agent-browser' on the EC2 instance."
                : "Browser command failed.",
            details: err.stderr || err.message 
        });
    }
});

// --- RESOURCE MONITORING ---
app.get('/containers/:id/stats', auth, async (req, res) => {
    try {
        const raw = await docker.getContainer(req.params.id).stats({ stream: false });
        const cpuDelta = raw.cpu_stats.cpu_usage.total_usage - raw.precpu_stats.cpu_usage.total_usage;
        const systemDelta = raw.cpu_stats.system_cpu_usage - raw.precpu_stats.system_cpu_usage;
        const cpuCount = raw.cpu_stats.online_cpus || raw.cpu_stats.cpu_usage.percpu_usage?.length || 1;
        const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * cpuCount * 100 : 0;
        const memoryUsage = raw.memory_stats.usage - (raw.memory_stats.stats?.cache || 0);
        const memoryLimit = raw.memory_stats.limit;

        res.json({
            cpuPercent: parseFloat(cpuPercent.toFixed(2)),
            memoryMb: parseFloat((memoryUsage / 1024 / 1024).toFixed(1)),
            memoryLimitMb: parseFloat((memoryLimit / 1024 / 1024).toFixed(1)),
        });
    } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }); }
});

// --- FLEET STATS COLLECTION ---
const NODE_ID = process.env.NODE_ID || 'ohio-bridge-1';
const NODE_REGION = process.env.NODE_REGION || 'us-east-2';
const PLATFORM_URL = process.env.PLATFORM_URL;

/**
 * Collects aggregate stats from all running containers and reports to platform.
 */
async function collectAndReportFleetStats() {
    if (!PLATFORM_URL || !BRIDGE_API_KEY) {
        return; // Skip if not configured
    }

    try {
        const containers = await docker.listContainers({
            filters: { label: ['agent-platform.managed=true'], status: ['running'] }
        });

        let totalCpuPercent = 0;
        let totalMemoryUsed = 0;
        let totalMemoryLimit = 0;
        let totalNetworkRx = 0;
        let totalNetworkTx = 0;

        for (const containerInfo of containers) {
            try {
                const container = docker.getContainer(containerInfo.Id);
                const raw = await container.stats({ stream: false });

                // CPU calculation
                const cpuDelta = raw.cpu_stats.cpu_usage.total_usage - raw.precpu_stats.cpu_usage.total_usage;
                const systemDelta = raw.cpu_stats.system_cpu_usage - raw.precpu_stats.system_cpu_usage;
                const cpuCount = raw.cpu_stats.online_cpus || raw.cpu_stats.cpu_usage.percpu_usage?.length || 1;
                const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * cpuCount * 100 : 0;
                totalCpuPercent += cpuPercent;

                // Memory calculation
                const memoryUsage = raw.memory_stats.usage - (raw.memory_stats.stats?.cache || 0);
                totalMemoryUsed += memoryUsage;
                totalMemoryLimit += raw.memory_stats.limit;

                // Network calculation
                if (raw.networks) {
                    for (const net of Object.values(raw.networks)) {
                        totalNetworkRx += net.rx_bytes || 0;
                        totalNetworkTx += net.tx_bytes || 0;
                    }
                }
            } catch (e) {
                // Skip containers that fail stats collection
            }
        }

        // Report to platform
        await fetch(`${PLATFORM_URL}/api/fleet/stats`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bridge-api-key': BRIDGE_API_KEY
            },
            body: JSON.stringify({
                nodeId: NODE_ID,
                nodeRegion: NODE_REGION,
                totalContainers: containers.length,
                totalCpuPercent: parseFloat(totalCpuPercent.toFixed(2)),
                totalMemoryUsed,
                totalMemoryLimit,
                totalNetworkRx,
                totalNetworkTx
            })
        });

        console.log(`[FleetStats] Reported: ${containers.length} containers, CPU: ${totalCpuPercent.toFixed(1)}%, RAM: ${(totalMemoryUsed / 1024 / 1024).toFixed(0)}MB`);
    } catch (err) {
        console.error('[FleetStats] Failed to report:', err.message, err.cause ? `(Cause: ${err.cause.message})` : '');
    }
}

// Report fleet stats every 30 seconds
setInterval(collectAndReportFleetStats, 30000);
// Also report on startup
setTimeout(collectAndReportFleetStats, 5000);

const PORT = process.env.PORT || 3001;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;

if (SSL_KEY_PATH && SSL_CERT_PATH) {
    const options = {
        key: fs.readFileSync(SSL_KEY_PATH),
        cert: fs.readFileSync(SSL_CERT_PATH)
    };
    https.createServer(options, app).listen(PORT, () => {
        console.log(`Compute Bridge listening on HTTPS port ${PORT}`);
    });
} else {
    app.listen(PORT, () => {
        console.log(`Compute Bridge listening on HTTP port ${PORT}`);
        console.warn("WARNING: Running on plain HTTP. Use a reverse proxy or provide SSL_KEY_PATH/SSL_CERT_PATH for production.");
    });
}
