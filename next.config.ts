import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,  // Permite deploy aunque haya errores TS
  },
  eslint: {
    ignoreDuringBuilds: true, // Evita errores de ESLint en build
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
