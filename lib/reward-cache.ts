import { revalidatePath } from "next/cache";

const REWARD_SURFACE_PATHS = [
  "/admin/rewards",
  "/admin/coupons",
  "/rewards",
  "/redeem",
];

export function revalidateRewardSurfaces(couponCodes: string[] = []) {
  for (const path of REWARD_SURFACE_PATHS) {
    revalidatePath(path);
  }

  for (const code of couponCodes) {
    const safeCode = String(code || "").trim();
    if (!safeCode) continue;
    revalidatePath(`/coupon/${encodeURIComponent(safeCode)}`);
  }
}
