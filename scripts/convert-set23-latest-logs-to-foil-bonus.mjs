import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LIMIT = Math.max(1, Math.floor(Number(process.argv[2] || 3)));
const SET_ORDER = 23;
const BONUS_NEX = 20000;
const BASE_NEX = 2500;
const REDEMPTION_TYPE = "foil_bonus";
const CONDITION_LABEL =
  "ใช้การ์ดฟอยล์ไม่ซ้ำเพิ่ม 60 แบบ รับเพิ่มทั้งหมดเป็น 20,000 Nex";
const REWARD_LABEL = `รับแลกเปลี่ยนเป็น จำนวน 2,500 Nex; ${CONDITION_LABEL} • เลือกเงื่อนไขเสริม: ${CONDITION_LABEL}`;

function normalizeSet23BonusItem(item, quantity = 1) {
  return {
    setId: String(item?.setId || "foil-set-23"),
    setOrder: SET_ORDER,
    setName: String(item?.setName || "Foil Collection Set 23"),
    rewardLabel: REWARD_LABEL,
    redemptionType: REDEMPTION_TYPE,
    conditionLabel: CONDITION_LABEL,
    nexValue: BONUS_NEX,
    quantity: Math.max(1, Math.floor(Number(quantity || item?.quantity || 1))),
    lineTotalNex:
      BONUS_NEX * Math.max(1, Math.floor(Number(quantity || item?.quantity || 1))),
  };
}

async function main() {
  const logs = await prisma.$queryRawUnsafe(
    `
      SELECT *
      FROM "CardSetRedemptionLog"
      WHERE "setOrder" = $1
        AND "status" = 'approved'
        AND COALESCE("redemptionType", 'standard') = 'standard'
        AND "nexValue" = $2
      ORDER BY COALESCE("approvedAt", "createdAt") DESC, "itemIndex" DESC
      LIMIT $3
    `,
    SET_ORDER,
    BASE_NEX,
    LIMIT
  );

  if (!logs.length) {
    console.log("No matching Set 23 standard approved logs found.");
    return;
  }

  const logIds = logs.map((log) => log.id);
  const redemptionIds = Array.from(
    new Set(logs.map((log) => String(log.redemptionId || "")).filter(Boolean))
  );

  for (const log of logs) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE "CardSetRedemptionLog"
        SET "rewardLabel" = $2,
            "redemptionType" = $3,
            "conditionLabel" = $4,
            "nexValue" = $5
        WHERE "id" = $1
      `,
      log.id,
      REWARD_LABEL,
      REDEMPTION_TYPE,
      CONDITION_LABEL,
      BONUS_NEX
    );
  }

  for (const redemptionId of redemptionIds) {
    const redemptionRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "CardSetRedemption" WHERE "id" = $1 LIMIT 1`,
      redemptionId
    );
    const redemption = redemptionRows[0];
    if (!redemption) continue;

    const detailLogs = await prisma.$queryRawUnsafe(
      `
        SELECT *
        FROM "CardSetRedemptionLog"
        WHERE "redemptionId" = $1
        ORDER BY "itemIndex" ASC
      `,
      redemptionId
    );

    const set23BonusLogs = detailLogs.filter(
      (log) =>
        Number(log.setOrder || 0) === SET_ORDER &&
        String(log.redemptionType || "") === REDEMPTION_TYPE
    );
    const quantity = set23BonusLogs.length || 1;
    const item = normalizeSet23BonusItem(redemption, quantity);
    const totalNex = detailLogs.reduce(
      (sum, log) => sum + Number(log.nexValue || 0),
      0
    );
    const rewardLabel =
      detailLogs.length === quantity
        ? item.rewardLabel
        : `CARD SET ${detailLogs.length} เซ็ต / ${detailLogs.length} ชุด`;
    const setName =
      detailLogs.length === quantity
        ? item.setName
        : `CARD SET ${detailLogs.length} ชุด`;

    await prisma.$executeRawUnsafe(
      `
        UPDATE "CardSetRedemption"
        SET "rewardLabel" = $2,
            "redemptionType" = $3,
            "conditionLabel" = $4,
            "nexValue" = $5,
            "itemsJson" = $6,
            "setName" = $7
        WHERE "id" = $1
      `,
      redemptionId,
      rewardLabel,
      item.redemptionType,
      item.conditionLabel,
      totalNex,
      JSON.stringify([item]),
      setName
    );
  }

  console.log(
    `Converted ${logs.length} Set 23 logs to foil bonus (${BONUS_NEX} NEX each): ${logIds.join(", ")}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
