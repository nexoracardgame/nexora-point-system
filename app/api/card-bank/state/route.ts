import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getCardBankAssetsForUser,
  getCardBankAssetsVersion,
} from "@/lib/card-bank-store";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const sessionUser = ((session || {}) as { user?: SessionUser }).user || {};
  const userId = String(sessionUser.id || "").trim();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const assets = await getCardBankAssetsForUser(userId);
  const dataVersion = getCardBankAssetsVersion(assets);

  return NextResponse.json(
    {
      ok: true,
      version: dataVersion,
      assets,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
