/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@aws-sdk/client-textract", "@prisma/client"],
  },
};

module.exports = nextConfig;
