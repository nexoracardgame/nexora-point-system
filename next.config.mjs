/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "profile.line-scdn.net",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "s.imgz.io",
      },
      {
        protocol: "https",
        hostname: "oitmcvkiseinypuaaxpn.supabase.co",
        pathname: "/storage/v1/object/public/chat-images/**",
      },
    ],
  },
};

export default nextConfig;
