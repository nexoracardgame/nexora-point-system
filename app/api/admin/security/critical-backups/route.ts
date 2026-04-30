import { NextResponse } from "next/server";
import { requireAdminActor } from "@/lib/admin-auth";
import {
  getCriticalBackup,
  listCriticalBackups,
  writeCriticalBackup,
} from "@/lib/critical-backup";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { error } = await requireAdminActor();
  if (error) return error;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || 80);
  const backups = await listCriticalBackups(limit);

  return NextResponse.json({
    success: true,
    backups: backups.map((backup) => ({
      ...backup,
      createdAt:
        backup.createdAt instanceof Date
          ? backup.createdAt.toISOString()
          : backup.createdAt,
    })),
  });
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function snapshotDate(value: unknown) {
  const raw = String(value || "").trim();
  return raw ? new Date(raw) : null;
}

export async function POST(req: Request) {
  const { actor, error } = await requireAdminActor();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "").trim();
  const mode = String(body?.mode || "before").trim();
  const confirm = String(body?.confirm || "").trim();

  if (!id || (mode !== "before" && mode !== "after")) {
    return NextResponse.json({ error: "invalid restore payload" }, { status: 400 });
  }

  if (confirm !== "RESTORE_CRITICAL_BACKUP") {
    return NextResponse.json({ error: "restore confirmation required" }, { status: 400 });
  }

  const backup = await getCriticalBackup(id);

  if (!backup) {
    return NextResponse.json({ error: "backup not found" }, { status: 404 });
  }

  const snapshot = asRecord(
    mode === "before" ? backup.beforeSnapshot : backup.afterSnapshot
  );
  const user = asRecord(snapshot.user);
  const reward = asRecord(snapshot.reward);
  const coupon = asRecord(snapshot.coupon);

  const restored = await prisma.$transaction(async (tx) => {
    const changes: Record<string, unknown> = {};

    if (user.id && (user.nexPoint !== undefined || user.coin !== undefined)) {
      const beforeUser = await tx.user.findUnique({
        where: { id: String(user.id) },
        select: { id: true, lineId: true, nexPoint: true, coin: true, name: true },
      });

      if (beforeUser) {
        const restoredUser = await tx.user.update({
          where: { id: String(user.id) },
          data: {
            ...(user.nexPoint !== undefined ? { nexPoint: Number(user.nexPoint) } : {}),
            ...(user.coin !== undefined ? { coin: Number(user.coin) } : {}),
          },
          select: { id: true, lineId: true, nexPoint: true, coin: true, name: true },
        });

        changes.user = { before: beforeUser, after: restoredUser };
      }
    }

    if (reward.id) {
      const beforeReward = await tx.reward.findUnique({
        where: { id: String(reward.id) },
      });

      const restoredReward = await tx.reward.upsert({
        where: { id: String(reward.id) },
        update: {
          name: String(reward.name || beforeReward?.name || "Restored reward"),
          imageUrl: reward.imageUrl ?? null,
          nexCost: reward.nexCost == null ? null : Number(reward.nexCost),
          coinCost: reward.coinCost == null ? null : Number(reward.coinCost),
          stock: Number(reward.stock || 0),
        },
        create: {
          id: String(reward.id),
          name: String(reward.name || "Restored reward"),
          imageUrl: reward.imageUrl ?? null,
          nexCost: reward.nexCost == null ? null : Number(reward.nexCost),
          coinCost: reward.coinCost == null ? null : Number(reward.coinCost),
          stock: Number(reward.stock || 0),
        },
      });

      changes.reward = { before: beforeReward, after: restoredReward };
    }

    if (coupon.id && coupon.code && coupon.userId && coupon.rewardId) {
      const beforeCoupon = await tx.coupon.findUnique({
        where: { id: String(coupon.id) },
      });

      const restoredCoupon = await tx.coupon.upsert({
        where: { id: String(coupon.id) },
        update: {
          code: String(coupon.code),
          userId: String(coupon.userId),
          rewardId: String(coupon.rewardId),
          used: Boolean(coupon.used),
          usedAt: snapshotDate(coupon.usedAt),
          createdAt: snapshotDate(coupon.createdAt) || undefined,
        },
        create: {
          id: String(coupon.id),
          code: String(coupon.code),
          userId: String(coupon.userId),
          rewardId: String(coupon.rewardId),
          used: Boolean(coupon.used),
          usedAt: snapshotDate(coupon.usedAt),
          createdAt: snapshotDate(coupon.createdAt) || undefined,
        },
      });

      changes.coupon = { before: beforeCoupon, after: restoredCoupon };
    }

    await writeCriticalBackup(tx, {
      scope: "admin",
      action: "critical.restore",
      actorUserId: actor?.id,
      entityType: backup.entityType,
      entityId: backup.entityId,
      beforeSnapshot: {
        sourceBackup: backup.id,
        mode,
        changes,
      },
      afterSnapshot: {
        restoredFrom: backup.id,
        mode,
        changes,
      },
      meta: {
        source: "admin-critical-backup-restore",
        backupId: backup.id,
        backupAction: backup.action,
      },
    });

    return changes;
  });

  return NextResponse.json({
    success: true,
    restored,
  });
}
