import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    output: "standalone",
    images: {
      unoptimized: true,
    },
    experimental: {
      optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
    },
  };
}
