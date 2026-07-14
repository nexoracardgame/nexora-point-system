import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const pricing = new Map([
  [25, { base: 3000, bonus: 6000, bonusCount: 30 }],
  [26, { base: 80000 }],
  [27, { base: 90000 }],
  [28, { base: 80000 }],
  [29, { base: 9000 }],
  [30, { base: 20000 }],
  [31, { base: 12000 }],
  [32, { base: 5500 }],
  [33, { base: 4000 }],
  [34, { base: 5500 }],
  [35, { base: 4500 }],
  [36, { base: 6500 }],
  [37, { base: 79000 }],
  [38, { base: 65000 }],
  [39, { base: 35000 }],
]);

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

function baseReward(amount) {
  return `รับแลกเปลี่ยนเป็น จำนวน ${formatNumber(amount)} Nex`;
}

function bonusLabel(rule) {
  return `ใช้การ์ดฟอยล์ไม่ซ้ำเพิ่ม ${rule.bonusCount} แบบ รับเพิ่มทั้งหมดเป็น ${formatNumber(rule.bonus)} Nex`;
}

function normalizeType(type, rule) {
  return type === "foil_bonus" && rule?.bonus ? "foil_bonus" : "standard";
}

function normalizeItem(item, fallbackRow) {
  const setOrder = Number(item?.setOrder || fallbackRow?.setOrder || 0);
  const rule = pricing.get(setOrder);
  if (!rule) return null;

  const quantity = Math.max(1, Math.floor(Number(item?.quantity || 1)));
  const redemptionType = normalizeType(item?.redemptionType, rule);
  const isBonus = redemptionType === "foil_bonus";
  const nexValue = isBonus ? rule.bonus : rule.base;
  const conditionLabel = isBonus ? bonusLabel(rule) : null;
  const rewardLabel = isBonus
    ? `${baseReward(rule.base)}; ${conditionLabel} • เลือกเงื่อนไขเสริม: ${conditionLabel}`
    : baseReward(rule.base);

  return {
    setId: String(item?.setId || fallbackRow?.setId || `foil-set-${setOrder}`),
    setOrder,
    setName: String(
      item?.setName || fallbackRow?.setName || `Foil Collection Set ${setOrder}`
    ),
    rewardLabel,
    redemptionType,
    conditionLabel,
    nexValue,
    quantity,
    lineTotalNex: nexValue * quantity,
  };
}

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT *
    FROM "CardSetRedemption"
    WHERE "setOrder" BETWEEN 25 AND 39
       OR "itemsJson" LIKE '%"setOrder":25%'
       OR "itemsJson" LIKE '%"setOrder":26%'
       OR "itemsJson" LIKE '%"setOrder":27%'
       OR "itemsJson" LIKE '%"setOrder":28%'
       OR "itemsJson" LIKE '%"setOrder":29%'
       OR "itemsJson" LIKE '%"setOrder":30%'
       OR "itemsJson" LIKE '%"setOrder":31%'
       OR "itemsJson" LIKE '%"setOrder":32%'
       OR "itemsJson" LIKE '%"setOrder":33%'
       OR "itemsJson" LIKE '%"setOrder":34%'
       OR "itemsJson" LIKE '%"setOrder":35%'
       OR "itemsJson" LIKE '%"setOrder":36%'
       OR "itemsJson" LIKE '%"setOrder":37%'
       OR "itemsJson" LIKE '%"setOrder":38%'
       OR "itemsJson" LIKE '%"setOrder":39%'
  `);

  let redemptionsUpdated = 0;
  for (const row of rows) {
    let sourceItems = null;
    if (row.itemsJson) {
      try {
        const parsed = JSON.parse(row.itemsJson);
        if (Array.isArray(parsed)) sourceItems = parsed;
      } catch {
        sourceItems = null;
      }
    }

    const items = (sourceItems || [row])
      .map((item) => normalizeItem(item, row))
      .filter(Boolean);

    if (!items.length) continue;

    const first = items[0];
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalNex = items.reduce((sum, item) => sum + item.lineTotalNex, 0);
    const rewardLabel =
      items.length === 1 && totalQuantity === 1
        ? first.rewardLabel
        : `CARD SET ${items.length} เซ็ต / ${totalQuantity} ชุด`;
    const setName =
      items.length === 1 ? first.setName : `CARD SET ${totalQuantity} ชุด`;

    await prisma.$executeRawUnsafe(
      `
        UPDATE "CardSetRedemption"
        SET "setId" = $2,
            "setOrder" = $3,
            "setName" = $4,
            "rewardLabel" = $5,
            "redemptionType" = $6,
            "conditionLabel" = $7,
            "nexValue" = $8,
            "itemsJson" = $9
        WHERE "id" = $1
      `,
      row.id,
      first.setId,
      first.setOrder,
      setName,
      rewardLabel,
      first.redemptionType,
      first.conditionLabel,
      totalNex,
      JSON.stringify(items)
    );
    redemptionsUpdated += 1;
  }

  const logs = await prisma.$queryRawUnsafe(`
    SELECT *
    FROM "CardSetRedemptionLog"
    WHERE "setOrder" BETWEEN 25 AND 39
  `);

  let logsUpdated = 0;
  for (const log of logs) {
    const item = normalizeItem(log, log);
    if (!item) continue;

    await prisma.$executeRawUnsafe(
      `
        UPDATE "CardSetRedemptionLog"
        SET "setId" = $2,
            "setOrder" = $3,
            "setName" = $4,
            "rewardLabel" = $5,
            "redemptionType" = $6,
            "conditionLabel" = $7,
            "nexValue" = $8
        WHERE "id" = $1
      `,
      log.id,
      item.setId,
      item.setOrder,
      item.setName,
      item.rewardLabel,
      item.redemptionType,
      item.conditionLabel,
      item.nexValue
    );
    logsUpdated += 1;
  }

  console.log(
    `Synced card set pricing: ${redemptionsUpdated} redemptions, ${logsUpdated} logs.`
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
