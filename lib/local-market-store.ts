import {
  ensureLocalStoreFile,
  readLocalStoreJson,
  writeLocalStoreJson,
} from "@/lib/local-store-dir";

export type LocalMarketListing = {
  id: string;
  cardNo: string;
  serialNo: string | null;
  price: number;
  sellerId: string;
  sellerName: string;
  sellerImage: string;
  status: string;
  likes: number;
  views: number;
  createdAt: string;
  cardName: string | null;
  imageUrl: string | null;
  rarity: string | null;
};

async function ensureStoreFile() {
  return ensureLocalStoreFile("local-market-listings.json");
}

async function readStore() {
  await ensureStoreFile();
  return readLocalStoreJson<LocalMarketListing>("local-market-listings.json");
}

async function writeStore(items: LocalMarketListing[]) {
  await ensureStoreFile();
  await writeLocalStoreJson(
    "local-market-listings.json",
    JSON.stringify(items, null, 2)
  );
}

export async function getLocalMarketListings() {
  return readStore();
}

export async function getLocalMarketListingById(id: string) {
  const items = await readStore();
  return items.find((item) => item.id === id) || null;
}

export async function getLocalMarketListingsBySeller(sellerId: string) {
  const items = await readStore();
  return items.filter(
    (item) => item.sellerId === sellerId && String(item.status || "").toLowerCase() === "active"
  );
}

export async function createLocalMarketListing(
  input: Omit<LocalMarketListing, "id" | "createdAt" | "likes" | "views" | "status">
) {
  const items = await readStore();

  const listing: LocalMarketListing = {
    id: `local-${Date.now()}`,
    createdAt: new Date().toISOString(),
    likes: 0,
    views: 0,
    status: "ACTIVE",
    ...input,
  };

  items.unshift(listing);
  await writeStore(items);

  return listing;
}

export async function updateLocalMarketListingPrice(id: string, price: number) {
  const items = await readStore();
  const next = items.map((item) =>
    item.id === id
      ? {
          ...item,
          price,
        }
      : item
  );

  await writeStore(next);
  return next.find((item) => item.id === id) || null;
}

export async function updateLocalMarketListingStatus(id: string, status: string) {
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

export async function incrementLocalMarketListingViews(
  id: string
): Promise<LocalMarketListing | null> {
  const items = await readStore();
  let updatedItem: LocalMarketListing | null = null;

  const next = items.map((item) => {
    if (item.id !== id) return item;

    updatedItem = {
      ...item,
      views: Number(item.views || 0) + 1,
    };

    return updatedItem;
  });

  await writeStore(next);
  return updatedItem;
}

export async function incrementLocalMarketListingLikes(
  id: string
): Promise<LocalMarketListing | null> {
  const items = await readStore();
  let updatedItem: LocalMarketListing | null = null;

  const next = items.map((item) => {
    if (item.id !== id) return item;

    updatedItem = {
      ...item,
      likes: Number(item.likes || 0) + 1,
    };

    return updatedItem;
  });

  await writeStore(next);
  return updatedItem;
}

export async function deleteLocalMarketListing(id: string) {
  const items = await readStore();
  const next = items.filter((item) => item.id !== id);
  await writeStore(next);
}

export async function syncLocalMarketIdentity(
  userId: string,
  sellerName: string,
  sellerImage: string
) {
  const items = await readStore();
  let changed = false;

  const next = items.map((item) => {
    if (item.sellerId !== userId) {
      return item;
    }

    changed = true;
    return {
      ...item,
      sellerName,
      sellerImage,
    };
  });

  if (changed) {
    await writeStore(next);
  }

  return next.filter((item) => item.sellerId === userId);
}
