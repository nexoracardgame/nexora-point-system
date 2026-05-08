import { createLocalNotification } from "@/lib/local-notification-store";

type WalletAsset = "NEX" | "COIN";

type WalletReceivedNotificationInput = {
  userId: string;
  asset: WalletAsset;
  amount: number;
  image?: string | null;
  source: string;
};

function formatWalletAmount(amount: number, asset: WalletAsset) {
  return amount.toLocaleString("th-TH", {
    maximumFractionDigits: asset === "NEX" ? 2 : 0,
  });
}

export async function createWalletReceivedNotification({
  userId,
  asset,
  amount,
  image,
  source,
}: WalletReceivedNotificationInput) {
  const safeUserId = String(userId || "").trim();
  const safeAmount = Number(amount);

  if (!safeUserId || !Number.isFinite(safeAmount) || safeAmount <= 0) {
    return null;
  }

  const amountLabel = formatWalletAmount(safeAmount, asset);

  return createLocalNotification({
    userId: safeUserId,
    type: "wallet",
    title: `ได้รับ ${amountLabel} ${asset}`,
    body: `${asset} ถูกเพิ่มเข้ากระเป๋า NEX POINT แล้ว กดดูยอดล่าสุดได้ที่ Wallet`,
    href: "/wallet",
    image: image || "/icon-512-nex-point.png",
    meta: {
      asset,
      amount: safeAmount,
      action: "add",
      source,
    },
  }).catch(() => null);
}
