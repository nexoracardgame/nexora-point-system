export const PROFILE_SYNC_EVENT = "nexora:profile-updated";

export type ProfileSyncDetail = {
  image?: string | null;
  name?: string | null;
  timestamp?: number;
};

export function emitProfileSync(detail: ProfileSyncDetail) {
  if (typeof window === "undefined") return;

  const payload: ProfileSyncDetail = {
    ...detail,
    timestamp: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent<ProfileSyncDetail>(PROFILE_SYNC_EVENT, {
      detail: payload,
    })
  );

  try {
    window.localStorage.setItem(PROFILE_SYNC_EVENT, JSON.stringify(payload));
  } catch {}
}

export function listenProfileSync(
  listener: (detail: ProfileSyncDetail) => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onProfileSync = (event: Event) => {
    listener((event as CustomEvent<ProfileSyncDetail>).detail || {});
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== PROFILE_SYNC_EVENT || !event.newValue) return;

    try {
      listener(JSON.parse(event.newValue) as ProfileSyncDetail);
    } catch {}
  };

  window.addEventListener(PROFILE_SYNC_EVENT, onProfileSync as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(
      PROFILE_SYNC_EVENT,
      onProfileSync as EventListener
    );
    window.removeEventListener("storage", onStorage);
  };
}
