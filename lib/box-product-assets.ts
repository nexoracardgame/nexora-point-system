import "server-only";

import {
  BOX_PRODUCT_PUBLIC_DIR,
  type BoxProductAsset,
} from "@/lib/box-market-types";

const BOX_PRODUCT_ASSET_NAMES = [
  "Bronze-Box.png",
  "Bronze-Pack.png",
  "Glod-Box.png",
  "Gold-Pack.png",
  "Silver-Box.png",
  "Silver-Pack.png",
] as const;

export function getBoxProductAssets(): BoxProductAsset[] {
  return BOX_PRODUCT_ASSET_NAMES.map((name) => ({
    name,
    url: `/${BOX_PRODUCT_PUBLIC_DIR}/${encodeURIComponent(name)}`,
  }));
}
