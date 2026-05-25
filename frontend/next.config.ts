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
        hostname: "*.up.railway.app",
      },
    ],
  },
  async rewrites() {
    // If an external API is specified, proxy all frontend /api requests to it.
    // This perfectly solves cross-domain Auth and Session SSR cookie passing.
    if (process.env.API_ORIGIN) {
      let apiOrigin = process.env.API_ORIGIN;
      if (!apiOrigin.startsWith("http://") && !apiOrigin.startsWith("https://")) {
        // Fallback to http:// if no scheme is provided (e.g. Railway internal DNS)
        apiOrigin = `http://${apiOrigin}`;
      }
      
      return [
        {
          source: "/api/:path*",
          destination: `${apiOrigin}/api/:path*`,
        },
      ];
    }
    return [];
  },
  output: "standalone",
};

export default nextConfig;
