import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
