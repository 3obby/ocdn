import type { NextConfig } from "next";

const signerUrl = process.env.SIGNER_URL;
if (signerUrl) {
  console.log(`[next.config] SIGNER_URL=${signerUrl} — rewrites enabled`);
} else {
  console.log("[next.config] SIGNER_URL not set — rewrites disabled");
}

const nextConfig: NextConfig = {
  output: "standalone",
  rewrites: signerUrl
    ? async () => ({
        beforeFiles: [
          { source: "/api/post", destination: `${signerUrl}/api/post` },
          { source: "/api/reply", destination: `${signerUrl}/api/reply` },
          { source: "/api/burn", destination: `${signerUrl}/api/burn` },
          { source: "/api/signal", destination: `${signerUrl}/api/signal` },
          { source: "/api/costs", destination: `${signerUrl}/api/costs` },
          { source: "/api/health", destination: `${signerUrl}/api/health` },
          { source: "/api/payment", destination: `${signerUrl}/api/payment` },
        ],
      })
    : undefined,
};

export default nextConfig;
