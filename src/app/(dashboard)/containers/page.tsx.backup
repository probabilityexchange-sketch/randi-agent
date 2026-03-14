"use client";

import Link from "next/link";
import { useContainers } from "@/hooks/useContainers";
import { ContainerCard } from "@/components/containers/ContainerCard";

export default function ContainersPage() {
  const { containers, loading, stopContainer } = useContainers();

  const active = containers.filter((c) => c.status === "RUNNING");
  const inactive = containers.filter((c) => c.status !== "RUNNING");

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Containers</h1>
        <Link
          href="/agents"
          className="px-4 py-2 bg-primary hover:bg-accent text-primary-foreground rounded-lg text-sm font-medium transition-colors"
        >
          Launch New
        </Link>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading containers...</div>
      ) : containers.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground mb-4">No containers yet</p>
          <Link
            href="/agents"
            className="px-4 py-2 bg-primary hover:bg-accent text-primary-foreground rounded-lg text-sm font-medium transition-colors"
          >
            Launch an Agent
          </Link>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">
                Active ({active.length})
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {active.map((container) => (
                  <ContainerCard
                    key={container.id}
                    container={container}
                    onStop={stopContainer}
                  />
                ))}
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">
                History ({inactive.length})
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {inactive.map((container) => (
                  <ContainerCard
                    key={container.id}
                    container={container}
                    onStop={stopContainer}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
