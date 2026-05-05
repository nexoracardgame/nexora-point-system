import { NextResponse } from "next/server";
import { getWebPushPublicKey } from "@/lib/push-notification-store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET() {
  try {
    const publicKey = await getWebPushPublicKey();

    return NextResponse.json(
      {
        publicKey,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        publicKey: "",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
