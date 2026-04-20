import { promises as fs } from "fs";
import path from "path";

export type LocalDealRecord = {
  id: string;
  cardId: string;
  buyerId: string;
  buyerName: string;
  buyerImage: string;
  sellerId: string;
  sellerName: string;
  sellerImage: string;
  offeredPrice: number;
  status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
  createdAt: string;
  cardName: string;
  cardNo: string;
  cardImage: string;
  listedPrice: number;
  serialNo: string | null;
  listingStatus: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "local-deals.json");

function isLocalDev() {
  return process.env.NODE_ENV !== "production";
}

async function ensureStoreFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]", "utf8");
  }
}

async function readStore() {
  if (!isLocalDev()) return [];

  await ensureStoreFile();

  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalDealRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeStore(items: LocalDealRecord[]) {
  if (!isLocalDev()) return;

  await ensureStoreFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(items, null, 2), "utf8");
}

export async function getLocalDealsForUser(userId: string) {
  const items = await readStore();
  return items.filter(
    (item) =>
      (item.buyerId === userId || item.sellerId === userId) &&
      (item.status === "pending" || item.status === "accepted")
  );
}

export async function getAllLocalDeals() {
  return readStore();
}

export async function getLocalDealById(id: string) {
  const items = await readStore();
  return items.find((item) => item.id === id) || null;
}

export async function findExistingLocalOpenDeal(cardId: string, buyerId: string) {
  const items = await readStore();
  return (
    items.find(
      (item) =>
        item.cardId === cardId &&
        item.buyerId === buyerId &&
        (item.status === "pending" || item.status === "accepted")
    ) || null
  );
}

export async function createLocalDeal(
  input: Omit<LocalDealRecord, "id" | "createdAt" | "status">
) {
  const items = await readStore();

  const deal: LocalDealRecord = {
    id: `local-deal-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "pending",
    ...input,
  };

  items.unshift(deal);
  await writeStore(items);
  return deal;
}

export async function updateLocalDealStatus(
  id: string,
  status: LocalDealRecord["status"]
) {
  const items = await readStore();
  const next = items.map((item) =>
    item.id === id
      ? {
          ...item,
          status,
        }
      : item
  );

  await writeStore(next);
  return next.find((item) => item.id === id) || null;
}

export async function deleteLocalDeal(id: string) {
  const items = await readStore();
  const next = items.filter((item) => item.id !== id);
  await writeStore(next);
}

export async function syncLocalDealIdentity(
  userId: string,
  name: string,
  image: string
) {
  const items = await readStore();
  let changed = false;

  const next = items.map((item) => {
    if (item.buyerId === userId) {
      changed = true;
      return {
        ...item,
        buyerName: name,
        buyerImage: image,
      };
    }

    if (item.sellerId === userId) {
      changed = true;
      return {
        ...item,
        sellerName: name,
        sellerImage: image,
      };
    }

    return item;
  });

  if (changed) {
    await writeStore(next);
  }

  return next.filter((item) => item.buyerId === userId || item.sellerId === userId);
}
