"use client";

import Link from "next/link";
import type { ContainerInfo } from "@/types/container";
import { StatusBadge } from "./StatusBadge";

interface ContainerCardProps {
  container: ContainerInfo;
  onStop: (id: string) => void;
}

export function ContainerCard({ container, onStop }: ContainerCardProps) {
  const expiresAt = new Date(container.expiresAt);
  const now = new Date();
  const timeLeft = expiresAt.getTime() - now.getTime();
  const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
  const minutesLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)));

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium">{container.agentName}</h3>
          <p className="text-sm text-muted-foreground">{container.subdomain}</p>
        </div>
        <StatusBadge status={container.status} />
      </div>

      {container.url && container.status === "RUNNING" && (
        <a
          href={container.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-primary hover:text-accent truncate mb-3"
        >
          {container.url}
        </a>
      )}

      {container.password && container.status === "RUNNING" && (
        <div className="bg-muted rounded-lg p-2 mb-3">
          <p className="text-xs text-muted-foreground">Password</p>
          <p className="text-sm font-mono">{container.password}</p>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {container.status === "RUNNING"
            ? `${hoursLeft}h ${minutesLeft}m remaining`
            : `Used ${container.tokensUsed} tokens`}
        </span>
        <div className="flex gap-2">
          <Link
            href={`/containers/${container.id}`}
            className="text-primary hover:text-accent text-sm"
          >
            Details
          </Link>
          {container.status === "RUNNING" && (
            <button
              onClick={() => onStop(container.id)}
              className="text-destructive hover:text-destructive/80 text-sm"
            >
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
