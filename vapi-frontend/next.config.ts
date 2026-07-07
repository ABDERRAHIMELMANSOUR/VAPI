import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // runtime image only needs node + the traced files, not node_modules.
  output: "standalone",
  // The monorepo has a second lockfile at the repo root (the backend's).
  // Pin file tracing to this app so standalone output is rooted at
  // .next/standalone/server.js instead of being nested under vapi-frontend/.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
