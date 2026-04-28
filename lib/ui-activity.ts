const UI_ACTIVITY_EVENT = "nexora:ui-activity";

type UiActivityDetail =
  | { type: "start"; id: string }
  | { type: "end"; id: string };

function emitUiActivity(detail: UiActivityDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(UI_ACTIVITY_EVENT, {
      detail,
    })
  );
}

export function getUiActivityEventName() {
  return UI_ACTIVITY_EVENT;
}

export function beginUiActivity() {
  const id = `ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  emitUiActivity({ type: "start", id });
  return id;
}

export function endUiActivity(id: string) {
  if (!id) {
    return;
  }

  emitUiActivity({ type: "end", id });
}

export async function trackUiActivity<T>(task: () => Promise<T>) {
  const activityId = beginUiActivity();

  try {
    return await task();
  } finally {
    endUiActivity(activityId);
  }
}

export function trackUiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  return trackUiActivity(() => fetch(input, init));
}
