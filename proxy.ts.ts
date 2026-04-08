import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/wallet/:path*",
    "/market/:path*",
    "/settings/:path*",
  ],
};