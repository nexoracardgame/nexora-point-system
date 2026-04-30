const REWARD_IMAGE_VERSION_PARAM = "nxrRewardImageV";

export function stampRewardImageUrl(
  imageUrl: string | null | undefined,
  version: number | string = Date.now()
) {
  const raw = String(imageUrl || "").trim();

  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw || null;
  }

  const hashIndex = raw.indexOf("#");
  const withoutHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const hash = hashIndex >= 0 ? raw.slice(hashIndex) : "";
  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(query);

  params.set(REWARD_IMAGE_VERSION_PARAM, String(version || Date.now()));

  const nextQuery = params.toString();
  return `${path}${nextQuery ? `?${nextQuery}` : ""}${hash}`;
}

export function safeRewardImageUrl(imageUrl: string | null | undefined) {
  const raw = String(imageUrl || "").trim();
  return raw || "/avatar.png";
}
