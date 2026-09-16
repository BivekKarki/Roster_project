import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Profile photos are resized to ~40 KB in the browser; this leaves room for our own 1 MB check
    // so an oversized upload gets a friendly message instead of a framework error.
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Load these from node_modules at runtime instead of bundling them.
  // Bundling "ws" breaks its optional native helpers ("bufferUtil.mask is not a function"),
  // which kills the Neon database connection.
  serverExternalPackages: ["exceljs", "ws", "@neondatabase/serverless", "@prisma/adapter-neon"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
