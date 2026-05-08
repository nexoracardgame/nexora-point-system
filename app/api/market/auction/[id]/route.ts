import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  canDeleteAuctionRoom,
  deleteAuctionRoom,
  getAuctionRoomWithBids,
} from "@/lib/auction-store";
import { isAdminRole } from "@/lib/staff-auth";
import { resolveUserIdentity } from "@/lib/user-identity";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getAuctionRoomWithBids(String(id || "").trim());

    if (!data) {
      return NextResponse.json(
        { success: false, error: "ไม่พบห้องประมูลนี้" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        ...data,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("AUCTION ROOM ERROR:", error);
    return NextResponse.json(
      { success: false, error: "โหลดห้องประมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = String(session?.user?.role || "");
    const identity = await resolveUserIdentity(session?.user);
    const actorId = String(session?.user?.id || identity.userId || "").trim();
    const actorLineId = String(
      ((session?.user || {}) as { lineId?: string | null }).lineId || ""
    ).trim();

    if (!actorId) {
      return NextResponse.json(
        { success: false, error: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const safeId = String(id || "").trim();
    const canDelete = await canDeleteAuctionRoom({
      id: safeId,
      actorId,
      actorLineId,
      isAdmin: isAdminRole(role),
    });

    if (!canDelete) {
      return NextResponse.json(
        {
          success: false,
          error:
            "เฉพาะ GM/admin หรือเจ้าของห้องที่ยืนยันผู้ชนะแล้วเท่านั้นที่ลบห้องประมูลได้",
        },
        { status: 403 }
      );
    }

    const deleted = await deleteAuctionRoom(safeId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "ไม่พบห้องประมูลนี้" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("AUCTION ROOM DELETE ERROR:", error);
    return NextResponse.json(
      { success: false, error: "ลบห้องประมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
