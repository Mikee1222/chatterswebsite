import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloudflare: use @opennextjs/cloudflare (Workers). Build: npm run pages:build; deploy: npm run deploy:cf
  outputFileTracingRoot: path.join(__dirname, "."),
  webpack: (config) => {
    // react-day-picker imports `date-fns/locale`, which resolves to the barrel `locale.js` and pulls
    // every locale; webpack then chokes on some v4 locale modules (e.g. kk, km). We only need en-US.
    config.resolve.alias = {
      ...config.resolve.alias,
      "date-fns/locale$": path.join(__dirname, "node_modules", "date-fns", "locale", "en-US.js"),
    };
    return config;
  },
  async redirects() {
    return [
      { source: "/manifest", destination: "/manifest.json", permanent: false },
      { source: "/manifest.webmanifest", destination: "/manifest.json", permanent: false },
      { source: "/apple-touch-icon.png", destination: "/apple-touch-icon-v2.png", permanent: false },
      { source: "/apple-touch-icon-precomposed.png", destination: "/apple-touch-icon-precomposed-v2.png", permanent: false },
    ];
  },
};

export default nextConfig;
