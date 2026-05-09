import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloudflare: use @opennextjs/cloudflare (Workers). Build: npm run pages:build; deploy: npm run deploy:cf
  outputFileTracingRoot: path.join(__dirname, "."),
  async redirects() {
    return [
      { source: "/manifest", destination: "/manifest.webmanifest", permanent: false },
      { source: "/apple-touch-icon.png", destination: "/apple-touch-icon-v2.png", permanent: false },
      { source: "/apple-touch-icon-precomposed.png", destination: "/apple-touch-icon-precomposed-v2.png", permanent: false },
    ];
  },
};

export default nextConfig;
