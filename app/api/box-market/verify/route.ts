import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getBoxMarketSessionUser,
  resolveBoxMarketUserId,
  type BoxMarketSessionUser,
} from "@/lib/box-market-auth";
import {
  getDealerVerificationStatus,
  upsertDealerVerification,
} from "@/lib/box-market-store";
import { verifyDealerAgainstSheet } from "@/lib/dealer-sheet";
import { resolveUserIdentity } from "@/lib/user-identity";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type BoxMarketSession = {
  user?: BoxMarketSessionUser;
};

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...(init?.headers || {}),
    },
  });
}

function clean(value: unknown) {
  return String(value || "").trim();
}

async function getCurrentUserId() {
  const session = (await getServerSession(authOptions)) as BoxMarketSession | null;
  const sessionUser = getBoxMarketSessionUser(session);
  const identity = await resolveUserIdentity({
    id: sessionUser.id || undefined,
    name: sessionUser.name,
    image: sessionUser.image,
  });
  return resolveBoxMarketUserId(sessionUser, identity);
}

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return jsonNoStore({ verified: false, status: "none", verifiedAt: null });
  }

  return jsonNoStore(await getDealerVerificationStatus(userId));
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return jsonNoStore({ error: "กรุณาเข้าสู่ระบบก่อนยืนยันตัวแทน" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const fullName = clean(body?.fullName);
    const memberId = clean(body?.memberId);
    const phone = clean(body?.phone);
    const nationalId = clean(body?.nationalId);
    const lineContactId = clean(body?.lineContactId) || null;
    const email = clean(body?.email) || null;

    if (!fullName || !memberId || !phone || !nationalId) {
      return jsonNoStore(
        { error: "กรอกข้อมูลจำเป็นให้ครบก่อนยืนยัน" },
        { status: 400 }
      );
    }

    const matched = await verifyDealerAgainstSheet({
      fullName,
      memberId,
      phone,
      nationalId,
    });

    if (!matched) {
      return jsonNoStore(
        { error: "ข้อมูลไม่ตรงกับรายชื่อตัวแทนจำหน่ายในชีต" },
        { status: 400 }
      );
    }

    const status = await upsertDealerVerification({
      userId,
      fullName,
      memberId,
      phone,
      nationalId,
      lineContactId,
      email,
    });

    return jsonNoStore({ success: true, ...status });
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith("dealer-sheet-")
        ? "ยังอ่าน Google Sheet ตัวแทนจำหน่ายไม่ได้"
        : "ยืนยันตัวแทนจำหน่ายไม่สำเร็จ";

    return jsonNoStore({ error: message }, { status: 500 });
  }
}
