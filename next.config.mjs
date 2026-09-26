/** @type {import('next').NextConfig} */
const nextConfig = {
  // R3F v9 inherits StrictMode into the Canvas; in dev the double-mount
  // force-loses WebGL contexts. StrictMode has no effect on the production
  // static export, so disabling it here only changes dev behavior.
  reactStrictMode: false,
  output: "export",
  basePath: "/CVWebsite",
  trailingSlash: true,
  transpilePackages: ["three"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
