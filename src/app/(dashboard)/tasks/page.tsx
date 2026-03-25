"use client";

import { useState } from "react";

export default function TasksPage() {
  const [project, setProject] = useState("agent-platform");
  const [task, setTask] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [selfMaintStatus, setSelfMaintStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [selfMaintMessage, setSelfMaintMessage] = useState("");

  const handleSpawnTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/tasks/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, task }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to spawn task");
      }

      setStatus("success");
      setMessage(data.message || "Autonomous developer spawned successfully.");
      setTask("");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message);
    }
  };

  const handleSelfMaintenance = async () => {
    setSelfMaintStatus("loading");
    setSelfMaintMessage("");

    try {
      const res = await fetch("/api/self-maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPath: "src", autoFix: true }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to run self-maintenance");
      }

      setSelfMaintStatus("success");
      setSelfMaintMessage(`Maintenance complete. Fixed ${data.executionResults?.length || 0} issues. Total issues found: ${data.analysis?.totalIssues || 0}`);
    } catch (err: any) {
      setSelfMaintStatus("error");
      setSelfMaintMessage(err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Employee Tasks</h1>
        <p className="text-muted-foreground mt-2">
          Delegate engineering tasks and maintenance routines to Randi.
        </p>
      </div>

      {/* Active Employees Status */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Background Employees</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-background/50 border border-border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <div>
                <p className="text-sm font-medium">Code Auditor</p>
                <p className="text-[10px] text-muted-foreground">Monitoring Google Sheet</p>
              </div>
            </div>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono uppercase">Active</span>
          </div>
          
          <div className="bg-background/50 border border-border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <div>
                <p className="text-sm font-medium">Lead Gen</p>
                <p className="text-[10px] text-muted-foreground">Monitoring Twitter/X</p>
              </div>
            </div>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono uppercase">Active</span>
          </div>

          <div className="bg-background/50 border border-border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <div>
                <p className="text-sm font-medium">SEO Scout</p>
                <p className="text-[10px] text-muted-foreground">Monitoring Randi.agency</p>
              </div>
            </div>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono uppercase">Active</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Spawn Developer</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Assign a specific issue or feature to an autonomous agent running on your EC2 compute bridge.
          </p>

          <form onSubmit={handleSpawnTask} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Project / Repo Name</label>
              <input
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Task Description</label>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                rows={4}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Implement a new API route for..."
                required
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
            >
              {status === "loading" ? "Spawning..." : "Assign Task"}
            </button>
            {message && (
              <p className={`text-sm mt-2 ${status === "error" ? "text-red-500" : "text-green-500"}`}>
                {message}
              </p>
            )}
          </form>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Self-Maintenance</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Run the internal code analyzer to format code, fix linting errors, and maintain project standards automatically.
          </p>

          <button
            onClick={handleSelfMaintenance}
            disabled={selfMaintStatus === "loading"}
            className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
          >
            {selfMaintStatus === "loading" ? "Analyzing & Fixing..." : "Run Self-Maintenance Loop"}
          </button>
          
          {selfMaintMessage && (
            <div className={`mt-4 p-3 rounded-md text-sm ${selfMaintStatus === "error" ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"}`}>
              {selfMaintMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
