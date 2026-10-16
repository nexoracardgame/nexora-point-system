import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => req.nextUrl.pathname === "/game" || req.nextUrl.pathname.startsWith("/game/") || Boolean(token),
  },
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|login|blaze-embed|market-embed|.*\\.[^/]+$).*)",
  ],
};
