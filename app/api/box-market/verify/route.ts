import { NextRequest, NextResponse } from "next/server";
import {
  getBoxMarketRequestUser,
  resolveBoxMarketUserId,
} from "@/lib/box-market-auth";
import {
  getDealerVerificationStatus,
  upsertDealerVerification,
} from "@/lib/box-market-store";
import { verifyDealerAgainstSheet } from "@/lib/dealer-sheet";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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

async function getCurrentUserId(req: NextRequest) {
  const sessionUser = await getBoxMarketRequestUser(req);
  const identity = {
    userId: String(sessionUser.id || "").trim(),
    name: String(sessionUser.name || "NEXORA User").trim(),
    image: String(sessionUser.image || "/avatar.png").trim(),
  };
  return resolveBoxMarketUserId(sessionUser, identity);
}

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId(req);

  if (!userId) {
    return jsonNoStore({ verified: false, status: "none", verifiedAt: null });
  }

  return jsonNoStore(await getDealerVerificationStatus(userId));
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);

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
