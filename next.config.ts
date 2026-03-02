import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["dockerode"],
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
