import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/",
    "/market/:path*",
    "/wallet/:path*",
    "/rewards/:path*",
    "/redeem/:path*",
    "/collections/:path*",
    "/community/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/scan/:path*",
    "/dashboard/:path*",
  ],
};