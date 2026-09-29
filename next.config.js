/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 是原生 C++ 模块，必须排除在服务端打包之外（运行时动态加载）
  serverExternalPackages: ['better-sqlite3'],
};

module.exports = nextConfig;
