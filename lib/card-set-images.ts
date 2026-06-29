const CARD_SET_SOURCE_EXTENSIONS: Record<number, string> = {
  1: "jpg",
  2: "png",
  3: "jpg",
  4: "jpg",
  5: "jpg",
  6: "jpg",
  7: "jpg",
  8: "jpg",
  9: "jpg",
  10: "jpg",
  11: "jpg",
  12: "png",
  13: "png",
  14: "png",
  15: "jpg",
  16: "png",
  17: "png",
  18: "png",
  19: "jpg",
  20: "png",
  21: "png",
  22: "png",
  23: "png",
  24: "png",
  25: "png",
  26: "png",
  27: "png",
  28: "png",
  29: "png",
  30: "png",
  31: "png",
  32: "png",
  33: "png",
  34: "png",
  35: "png",
  36: "png",
  37: "png",
  38: "png",
  39: "png",
  40: "png",
};

export const CARD_SET_IMAGE_VERSION = "20260629080852-card-set";

export function getCardSetImageUrls(order: number) {
  const extension = CARD_SET_SOURCE_EXTENSIONS[order] || "png";

  return {
    coverImage: `/card-sets/optimized/${order}.webp?v=${CARD_SET_IMAGE_VERSION}`,
    fallbackImage: `/card-sets/${order}.${extension}?v=${CARD_SET_IMAGE_VERSION}`,
  };
}
