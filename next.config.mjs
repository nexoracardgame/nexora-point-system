/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 20,
      static: 180,
    },
  },
  outputFileTracingExcludes: {
    "/*": ["./public/**/*"],
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
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
    ];
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
    const reusableAssetHeaders = [
      {
        key: "Cache-Control",
        value: "public, max-age=3600, stale-while-revalidate=86400",
      },
    ];

    return [
      {
        source: "/cards/:path*",
        headers: reusableAssetHeaders,
      },
      {
        source: "/box-products/:path*",
        headers: reusableAssetHeaders,
      },
      {
        source: "/model/:path*",
        headers: reusableAssetHeaders,
      },
      {
        source: "/card-vectors.json",
        headers: reusableAssetHeaders,
      },
      {
        source: "/seller-cover.jpg",
        headers: reusableAssetHeaders,
      },
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
        source: "/market-embed/:path*",
        headers: [
          ...commonSecurityHeaders,
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
      {
        source: "/((?!(?:blaze-embed|market-embed)(?:/|$)).*)",
        headers: commonSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
