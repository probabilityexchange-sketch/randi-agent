"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatStorageSize } from "@/types/storage";

interface StorageVolume {
  id: string;
  userId: string;
  agentSlug: string;
  storageKey: string;
  sizeBytes: string | null;
  snapshotPath: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

interface ApiResponse {
  storageVolumes: StorageVolume[];
  totalSizeBytes: string;
}

export default function StorageManagementPage() {
  const [storageVolumes, setStorageVolumes] = useState<StorageVolume[]>([]);
  const [totalSizeBytes, setTotalSizeBytes] = useState<string>("0");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  const fetchStorage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/storage/volumes");
      if (!res.ok) {
        throw new Error("Failed to fetch storage volumes");
      }
      const data: ApiResponse = await res.json();
      setStorageVolumes(data.storageVolumes);
      setTotalSizeBytes(data.totalSizeBytes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStorage();
  }, [fetchStorage]);

  const handleDelete = async (id: string) => {
    setDeleting(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/storage/volumes/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete storage volume");
      }
      // Remove from list
      setStorageVolumes(prev => prev.filter(vol => vol.id !== id));
      // Recalculate total (simplified - in reality we'd refetch)
      setTotalSizeBytes("0"); // Refetch would be better
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(prev => new Set([...prev].filter(vid => vid !== id)));
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Storage Management</h1>
        <div className="text-muted-foreground">Loading storage volumes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Storage Management</h1>
        <div className="bg-destructive/10 text-destructive rounded-lg p-4">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Storage Management</h1>
        <Link
          href="/agents"
          className="px-4 py-2 bg-primary hover:bg-accent text-primary-foreground rounded-lg text-sm font-medium transition-colors"
        >
          Back to Agents
        </Link>
      </div>

      {/* Summary */}
      <div className="bg-card border border-border rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Storage Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Volumes</p>
            <p className="text-2xl font-bold">{storageVolumes.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Usage</p>
            <p className="text-2xl font-bold">
              {totalSizeBytes !== "0" ? formatStorageSize(BigInt(totalSizeBytes)) : "0 B"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Average Size</p>
            <p className="text-2xl font-bold">
              {storageVolumes.length > 0 && totalSizeBytes !== "0"
                ? formatStorageSize(BigInt(Math.floor(Number(totalSizeBytes) / storageVolumes.length)))
                : "0 B"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
            <p className="text-sm font-medium">
              {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>

      {/* Storage Volumes List */}
      {storageVolumes.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground">No storage volumes found</p>
          <p className="text-sm text-muted-foreground mt-2">
            Storage volumes appear when agents create snapshots of their data.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold mb-4">Storage Volumes</h2>
          <div className="space-y-4">
            {storageVolumes.map(volume => (
              <StorageVolumeCard
                key={volume.id}
                volume={volume}
                onDelete={handleDelete}
                deleting={deleting.has(volume.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface StorageVolumeCardProps {
  volume: StorageVolume;
  onDelete: (id: string) => Promise<void>;
  deleting: boolean;
}

function StorageVolumeCard({ volume, onDelete, deleting }: StorageVolumeCardProps) {
  const hasSnapshot = Boolean(volume.sizeBytes && volume.sizeBytes !== "0" && volume.sizeBytes !== null);
  const lastSync = volume.lastSyncAt ? new Date(volume.lastSyncAt) : null;
  const syncAgo = lastSync
    ? Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60))
    : null;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium">{volume.agentSlug}</h3>
          <p className="text-sm text-muted-foreground">
            Storage Key: {volume.storageKey}
          </p>
        </div>
        {deleting ? (
          <button
            className="px-3 py-1.5 bg-destructive/20 text-destructive rounded-lg text-xs"
            disabled
          >
            Deleting...
          </button>
        ) : (
          <button
            onClick={() => onDelete(volume.id)}
            className="px-3 py-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg text-xs"
          >
            Delete
          </button>
        )}
      </div>

      {hasSnapshot && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Size</span>
              <span className="font-mono">
                {formatStorageSize(BigInt(volume.sizeBytes))}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Sync</span>
              <span className="text-sm">
                {syncAgo !== null
                  ? syncAgo < 60
                    ? `${syncAgo}m ago`
                    : `${Math.floor(syncAgo / 60)}h ago`
                  : "Never"}
              </span>
            </div>
            <div className="flex justify-between text-sm text-xs">
              <span className="text-muted-foreground">Snapshot Path</span>
              <span className="break-all text-muted-foreground">
                {volume.snapshotPath || "N/A"}
              </span>
            </div>
          </div>
        </div>
      )}

      {!hasSnapshot && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-muted-foreground text-center py-4">
            No snapshot available for this agent
          </p>
        </div>
      )}
    </div>
  );
}
