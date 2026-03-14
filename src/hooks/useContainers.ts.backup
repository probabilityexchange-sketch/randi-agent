"use client";

import { useState, useEffect, useCallback } from "react";
import type { ContainerInfo } from "@/types/container";
import { fetchApi } from "@/lib/utils/api";

export function useContainers() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContainers = useCallback(async () => {
    try {
      setError(null);
      const res = await fetchApi("/api/containers");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to fetch containers");
        return;
      }
      const data = await res.json();
      setContainers(data.containers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContainers();
  }, [fetchContainers]);

  const launchContainer = async (agentId: string, hours: number) => {
    const res = await fetchApi("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, hours }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    const data = await res.json();
    await fetchContainers();
    return data;
  };

  const stopContainer = async (containerId: string) => {
    const res = await fetchApi(`/api/containers/${containerId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    await fetchContainers();
  };

  const extendContainer = async (containerId: string, hours: number) => {
    const res = await fetchApi(`/api/containers/${containerId}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    const data = await res.json();
    await fetchContainers();
    return data;
  };

  return {
    containers,
    loading,
    error,
    launchContainer,
    stopContainer,
    extendContainer,
    refresh: fetchContainers,
  };
}
