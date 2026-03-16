import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["dockerode", "@composio/core", "pg"],
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
