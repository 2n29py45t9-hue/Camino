import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the sandbox hostname used by Arena's live preview.
  allowedDevOrigins: ["*.e2b.app"],
  // Tailwind CSS v4's supported Turbopack loader from the Next.js starter.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
