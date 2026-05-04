import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      lineId: string;
      authProvider?: "line" | "google";
      sessionRevoked?: boolean;
      nexPoint?: number;
      coin?: number;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    role: string;
    lineId: string;
    authProvider?: "line" | "google";
    sessionRevoked?: boolean;
    nexPoint?: number;
    coin?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    lineId: string;
    authProvider?: "line" | "google";
    sessionRevoked?: boolean;
    sessionVersion?: number;
    sessionIssuedAt?: number;
    nexPoint?: number;
    coin?: number;
  }
}
