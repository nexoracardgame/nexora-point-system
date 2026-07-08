import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminActor } from "@/lib/admin-auth";
import { writeCriticalBackup } from "@/lib/critical-backup";
import { createWalletReceivedNotification } from "@/lib/wallet-notification";

type EvidenceImage = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

const MAX_EVIDENCE_IMAGES = 30;
const MAX_EVIDENCE_DATA_URL_LENGTH = 550_000;
const MAX_EVIDENCE_TOTAL_LENGTH = 8_000_000;

async function ensurePointLogEvidenceSchema() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "PointLog" ADD COLUMN IF NOT EXISTS "note" TEXT'
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "PointLog" ADD COLUMN IF NOT EXISTS "evidenceJson" TEXT'
  );
}

function parseOptionalAmount(value: unknown, integerOnly = false) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) {
    return null;
  }

  if (integerOnly && !Number.isInteger(amount)) {
    throw new Error("invalid_coin");
  }

  return amount;
}

function sanitizeEvidenceImages(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  let totalLength = 0;
  const images: EvidenceImage[] = [];

  for (const image of value) {
    if (images.length >= MAX_EVIDENCE_IMAGES) break;

    const dataUrl = String(image?.dataUrl || "");
    if (!dataUrl.startsWith("data:image/") || dataUrl.length > MAX_EVIDENCE_DATA_URL_LENGTH) {
      continue;
    }

    totalLength += dataUrl.length;
    if (totalLength > MAX_EVIDENCE_TOTAL_LENGTH) {
      break;
    }

    images.push({
      name: String(image?.name || "evidence").slice(0, 180),
      type: String(image?.type || "image/jpeg").slice(0, 80),
      size: Math.max(0, Number(image?.size || 0)),
      dataUrl,
    });
  }

  return images;
}

export async function POST(req: Request) {
  try {
    const { actor, error } = await requireAdminActor();
    if (error) return error;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง" },
        { status: 400 }
      );
    }

    const { lineId, nexAmount, coinAmount, note, evidenceImages } = body as {
      lineId?: unknown;
      nexAmount?: unknown;
      coinAmount?: unknown;
      note?: unknown;
      evidenceImages?: unknown;
    };
    const cleanLineId = String(lineId || "").trim();
    const nextNexAmount = parseOptionalAmount(nexAmount);
    const nextCoinAmount = parseOptionalAmount(coinAmount, true);
    const cleanNote = String(note || "").trim().slice(0, 2000);
    const safeEvidenceImages = sanitizeEvidenceImages(evidenceImages);
    const evidenceJson = safeEvidenceImages.length
      ? JSON.stringify(safeEvidenceImages)
      : null;

    if (!cleanLineId || (nextNexAmount === null && nextCoinAmount === null)) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    await ensurePointLogEvidenceSchema();

    const result = await prisma.$transaction(async (tx) => {
      const beforeUser = await tx.user.findUnique({
        where: { lineId: cleanLineId },
        select: {
          id: true,
          lineId: true,
          name: true,
          image: true,
          nexPoint: true,
          coin: true,
        },
      });

      if (!beforeUser) {
        throw new Error("user_not_found");
      }

      if (
        nextNexAmount !== null &&
        Number(beforeUser.nexPoint || 0) + nextNexAmount < 0
      ) {
        throw new Error("insufficient_nex");
      }

      if (
        nextCoinAmount !== null &&
        Number(beforeUser.coin || 0) + nextCoinAmount < 0
      ) {
        throw new Error("insufficient_coin");
      }

      const updateData: {
        nexPoint?: { increment: number };
        coin?: { increment: number };
      } = {};

      if (nextNexAmount !== null) {
        updateData.nexPoint = { increment: nextNexAmount };
      }

      if (nextCoinAmount !== null) {
        updateData.coin = { increment: nextCoinAmount };
      }

      const updatedUser = await tx.user.update({
        where: { id: beforeUser.id },
        data: updateData,
      });

      if (nextNexAmount !== null) {
        await tx.$executeRawUnsafe(
          `
            INSERT INTO "PointLog" ("id", "lineId", "type", "amount", "point", "note", "evidenceJson", "createdAt")
            VALUES ($1, $2, 'admin', $3, $4, $5, $6, CURRENT_TIMESTAMP)
          `,
          crypto.randomUUID(),
          cleanLineId,
          Math.trunc(nextNexAmount),
          nextNexAmount,
          cleanNote || null,
          evidenceJson
        );
      }

      if (nextCoinAmount !== null) {
        await tx.$executeRawUnsafe(
          `
            INSERT INTO "PointLog" ("id", "lineId", "type", "amount", "point", "note", "evidenceJson", "createdAt")
            VALUES ($1, $2, 'admin_coin', $3, 0, $4, $5, CURRENT_TIMESTAMP)
          `,
          crypto.randomUUID(),
          cleanLineId,
          nextCoinAmount,
          cleanNote || null,
          evidenceJson
        );
      }

      await writeCriticalBackup(tx, {
        scope: "wallet",
        action: "admin.wallet.adjust",
        actorUserId: actor?.id,
        targetUserId: beforeUser.id,
        entityType: "User",
        entityId: beforeUser.id,
        beforeSnapshot: {
          user: beforeUser,
        },
        afterSnapshot: {
          user: {
            id: updatedUser.id,
            lineId: updatedUser.lineId,
            nexPoint: updatedUser.nexPoint,
            coin: updatedUser.coin,
            name: updatedUser.name,
          },
        },
        meta: {
          nexAmount: nextNexAmount,
          coinAmount: nextCoinAmount,
          note: cleanNote || null,
          evidenceImages: safeEvidenceImages.map((image) => ({
            name: image.name,
            type: image.type,
            size: image.size,
          })),
          evidenceImageCount: safeEvidenceImages.length,
          source: "admin-members-adjust-wallet",
        },
      });

      return {
        id: updatedUser.id,
        lineId: updatedUser.lineId,
        nexPoint: updatedUser.nexPoint,
        coin: updatedUser.coin,
        image: updatedUser.image,
      };
    });

    await Promise.all([
      nextNexAmount !== null && nextNexAmount > 0
        ? createWalletReceivedNotification({
            userId: result.id,
            asset: "NEX",
            amount: nextNexAmount,
            image: result.image,
            source: "admin-members-adjust-wallet",
          })
        : Promise.resolve(null),
      nextCoinAmount !== null && nextCoinAmount > 0
        ? createWalletReceivedNotification({
            userId: result.id,
            asset: "COIN",
            amount: nextCoinAmount,
            image: result.image,
            source: "admin-members-adjust-wallet",
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      success: true,
      user: result,
      changes: {
        nexAmount: nextNexAmount,
        coinAmount: nextCoinAmount,
      },
    });
  } catch (error) {
    console.error("ADJUST WALLET ERROR:", error);

    if (error instanceof Error) {
      if (error.message === "insufficient_nex") {
        return NextResponse.json(
          { error: "NEX ไม่พอให้หัก" },
          { status: 400 }
        );
      }

      if (error.message === "insufficient_coin") {
        return NextResponse.json(
          { error: "COIN ไม่พอให้หัก" },
          { status: 400 }
        );
      }

      if (error.message === "invalid_coin") {
        return NextResponse.json(
          { error: "COIN ต้องเป็นจำนวนเต็ม เช่น 100 หรือ -100" },
          { status: 400 }
        );
      }

      if (error.message === "user_not_found") {
        return NextResponse.json(
          { error: "ไม่พบสมาชิกนี้ กรุณารีเฟรชหน้าแล้วลองใหม่" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "อัปเดตแต้มไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
