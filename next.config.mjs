/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingExcludes: {
    "/box-market": ["./public/**/*"],
    "/api/box-market": ["./public/**/*"],
    "/api/box-market/verify": ["./public/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "profile.line-scdn.net",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh4.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh5.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh6.googleusercontent.com",
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
  async headers() {
    const commonSecurityHeaders = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value:
          "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
    ];

    return [
      {
        source: "/blaze-embed/:path*",
        headers: [
          ...commonSecurityHeaders,
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
      {
        source: "/((?!blaze-embed(?:/|$)).*)",
        headers: [
          ...commonSecurityHeaders,
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
