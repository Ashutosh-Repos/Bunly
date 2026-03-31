import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "4000",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
      },
      {
        protocol: "https",
        hostname: "laudable-manifestation-production-1555.up.railway.app",
      },
      {
        protocol: "https",
        hostname: "*.up.railway.app",
      },
    ],
  },
  output: "standalone",
};

export default nextConfig;
