type CachedChatPayload<TMessage, TMeta = Record<string, unknown>> = {
  messages: TMessage[];
  meta?: TMeta | null;
  cachedAt: number;
};

function buildKey(scope: string, id: string) {
  return `nexora_chat_cache:${scope}:${id}`;
}

export function readChatHistoryCache<TMessage, TMeta = Record<string, unknown>>(
  scope: string,
  id: string
): CachedChatPayload<TMessage, TMeta> | null {
  if (typeof window === "undefined" || !scope || !id) return null;

  try {
    const raw = window.sessionStorage.getItem(buildKey(scope, id));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedChatPayload<TMessage, TMeta>;
    if (!parsed || !Array.isArray(parsed.messages)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeChatHistoryCache<TMessage, TMeta = Record<string, unknown>>(
  scope: string,
  id: string,
  payload: CachedChatPayload<TMessage, TMeta>
) {
  if (typeof window === "undefined" || !scope || !id) return;

  try {
    window.sessionStorage.setItem(
      buildKey(scope, id),
      JSON.stringify({
        ...payload,
        cachedAt: Date.now(),
      })
    );
  } catch {
    return;
  }
}
