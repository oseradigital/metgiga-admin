import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1mb — too small for a real document upload (client
      // agreements, invoices with embedded images, etc). 15mb covers
      // the documents this feature is actually for; anything larger
      // belongs in a real deliverable host, not this table.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
