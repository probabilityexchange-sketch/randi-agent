import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/db/prisma";
import { createHash } from "crypto";

const STORAGE_BUCKET = "agent-storage";

let _supabase: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
    if (_supabase) return _supabase;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
        throw new Error(
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY env vars"
        );
    }

    _supabase = createClient(url, key, {
        auth: { persistSession: false },
    });
    return _supabase;
}

/** Deterministic key matching the provisioner's buildStorageKey */
export function buildStorageKey(userId: string, agentSlug: string): string {
    return createHash("sha256")
        .update(`${userId}:${agentSlug}`)
        .digest("hex")
        .slice(0, 16);
}

/** Supabase Storage object path for a given storageKey */
export function getSnapshotPath(storageKey: string): string {
    return `${storageKey}/snapshot.tar.gz`;
}

/** Returns true if a snapshot already exists in Supabase Storage */
export async function hasSnapshot(storageKey: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const path = getSnapshotPath(storageKey);

    const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list(storageKey);

    if (error || !data) return false;
    return data.some((f) => f.name === "snapshot.tar.gz");
}

/**
 * Returns a short-lived signed URL the EC2 bridge can use to download
 * the snapshot (60 second TTL — enough to start a download).
 */
export async function getSnapshotDownloadUrl(
    storageKey: string
): Promise<string | null> {
    const supabase = getSupabaseAdmin();
    const path = getSnapshotPath(storageKey);

    const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(path, 60);

    if (error || !data) return null;
    return data.signedUrl;
}

/**
 * Returns a short-lived signed URL the EC2 bridge can use to UPLOAD
 * a snapshot (300 second TTL).
 */
export async function getSnapshotUploadUrl(
    storageKey: string
): Promise<string | null> {
    const supabase = getSupabaseAdmin();
    const path = getSnapshotPath(storageKey);

    const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUploadUrl(path);

    if (error || !data) return null;
    return data.signedUrl;
}

/**
 * Record or update snapshot metadata in the database after a
 * successful upload from the bridge.
 */
export async function recordSnapshot(
    userId: string,
    agentSlug: string,
    storageKey: string,
    sizeBytes: number
): Promise<void> {
    const snapshotPath = getSnapshotPath(storageKey);

    await prisma.storageVolume.upsert({
        where: { storageKey },
        create: {
            userId,
            agentSlug,
            storageKey,
            sizeBytes: BigInt(sizeBytes),
            snapshotPath,
            lastSyncAt: new Date(),
        },
        update: {
            sizeBytes: BigInt(sizeBytes),
            snapshotPath,
            lastSyncAt: new Date(),
        },
    });
}

/**
 * Returns the StorageVolume record for a given userId+agentSlug,
 * or null if no snapshot has ever been taken.
 */
export async function getStorageVolume(userId: string, agentSlug: string) {
    const storageKey = buildStorageKey(userId, agentSlug);
    return prisma.storageVolume.findUnique({ where: { storageKey } });
}
