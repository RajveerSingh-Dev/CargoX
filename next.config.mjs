/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add this for Next.js 15+
  serverExternalPackages: ["pg", "pg-cloudflare"],
  
  // Add this for Next.js 13/14
  experimental: {
    serverComponentsExternalPackages: ["pg", "pg-cloudflare"],
  },
};

export default nextConfig; // (Use `module.exports = nextConfig;` if your file is .js)