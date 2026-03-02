import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   output: "standalone",
serverExternalPackages: ["dockerode"],
  experimental: {
  cpus: 1,
    workerThreads: false,
  },
turbopack: { },
webpack: (config) => {
  return config;
},
};

export default nextConfig;
