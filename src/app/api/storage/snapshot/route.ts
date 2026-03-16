import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import {
    buildStorageKey,
    getSnapshotUploadUrl,
    recordSnapshot,
    getStorageVolume,
    getSnapshotDownloadUrl,
} from "@/lib/storage/storage-service";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

/**
 * GET /api/storage/snapshot?agentSlug=...
 * Returns the current snapshot metadata for the authenticated user + agent.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth();

        const { allowed } = await checkRateLimit(`storage-snapshot:${auth.userId}`, RATE_LIMITS.provision);
        if (!allowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const agentSlug = req.nextUrl.searchParams.get("agentSlug");
        if (!agentSlug) {
            return NextResponse.json({ error: "agentSlug is required" }, { status: 400 });
        }

        const volume = await getStorageVolume(auth.userId, agentSlug);
        if (!volume) {
            return NextResponse.json({ exists: false });
        }

        return NextResponse.json({
            exists: true,
            agentSlug: volume.agentSlug,
            sizeBytes: volume.sizeBytes?.toString(),
            lastSyncAt: volume.lastSyncAt,
        });
    } catch (err) {
        return handleAuthError(err);
    }
}

/**
 * POST /api/storage/snapshot
 * Called by the EC2 bridge after a successful snapshot upload.
 * Updates the StorageVolume record with the new size/timestamp.
 *
 * Also called by the client to get a signed upload URL before
 * triggering the bridge to upload.
 *
 * Body: { agentSlug: string, action: "record" | "upload-url", sizeBytes?: number }
 */
// FIX (MEDIUM): Added Zod schema validation for POST body
const snapshotPostSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("upload-url"), agentSlug: z.string().min(1) }),
    z.object({ action: z.literal("record"), agentSlug: z.string().min(1), sizeBytes: z.number().int().nonnegative() }),
]);

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth();

        const { allowed } = await checkRateLimit(`storage-snapshot:${auth.userId}`, RATE_LIMITS.provision);
        if (!allowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const rawBody = await req.json();
        const parsed = snapshotPostSchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }
        const { agentSlug, action } = parsed.data;
        const sizeBytes = parsed.data.action === "record" ? parsed.data.sizeBytes : undefined;

        const storageKey = buildStorageKey(auth.userId, agentSlug);

        if (action === "upload-url") {
            const signedUrl = await getSnapshotUploadUrl(storageKey);
            if (!signedUrl) {
                return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
            }
            return NextResponse.json({ signedUrl, storageKey });
        }

        if (action === "record") {
            // sizeBytes is guaranteed to be a number here by the Zod schema
            await recordSnapshot(auth.userId, agentSlug, storageKey, sizeBytes!);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch (err) {
        return handleAuthError(err);
    }
}

/**
 * Internal-only: called by the bridge server via a shared secret.
 * Allows the bridge to record a completed snapshot without a user session.
 * PUT /api/storage/snapshot
 * Headers: x-bridge-api-key
 * Body: { storageKey: string, userId: string, agentSlug: string, sizeBytes: number }
 */
export async function PUT(req: NextRequest) {
    const bridgeKey = req.headers.get("x-bridge-api-key");
    if (!bridgeKey || bridgeKey !== process.env.COMPUTE_BRIDGE_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bridgePutSchema = z.object({
        storageKey: z.string().min(1),
        userId: z.string().min(1),
        agentSlug: z.string().min(1),
        sizeBytes: z.number().int().nonnegative(),
    });

    try {
        const rawBody = await req.json();
        const parsed = bridgePutSchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json({ error: "Missing required fields", details: parsed.error.flatten().fieldErrors }, { status: 400 });
        }

        await recordSnapshot(parsed.data.userId, parsed.data.agentSlug, parsed.data.storageKey, parsed.data.sizeBytes);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Bridge snapshot record failed:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
