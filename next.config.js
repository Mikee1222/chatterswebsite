/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloudflare: use @cloudflare/next-on-pages and npx @cloudflare/next-on-pages for build
  async redirects() {
    return [
      { source: "/apple-touch-icon.png", destination: "/icons/icon.svg", permanent: false },
      { source: "/apple-touch-icon-precomposed.png", destination: "/icons/icon.svg", permanent: false },
    ];
  },
};

export default nextConfig;
