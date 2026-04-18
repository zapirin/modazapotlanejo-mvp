import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
      allowedOrigins: [
        "modazapotlanejo.com",
        "www.modazapotlanejo.com",
        "zonadelvestir.com",
        "www.zonadelvestir.com",
        "kalexafashion.com",
        "www.kalexafashion.com",
        "localhost:3000",
        "kalexa.modazapotlanejo.com",
        "pos.kalexafashion.com",
        "kalexafashion.com",
        "www.kalexafashion.com",
      ],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "modazapotlanejo.com" },
      { protocol: "https", hostname: "kalexafashion.com" },
      { protocol: "https", hostname: "zonadelvestir.com" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
