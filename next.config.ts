import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/report/github.com/:path*", destination: "/report/github/:path*" },
      { source: "/report/huggingface.co/:path*", destination: "/report/huggingface/:path*" },
    ];
  },
};

export default nextConfig;
