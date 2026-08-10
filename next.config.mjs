/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // MuPDF ships WASM; load it from node_modules at runtime instead of bundling.
  experimental: { serverComponentsExternalPackages: ["mupdf"] },
};

export default nextConfig;
