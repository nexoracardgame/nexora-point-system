"use client";

import { useEffect, useRef, useState } from "react";
import { BATTLE_CHAT_CHANGED, mergeBattleChatMessages, visibleBattleChat, type BattleChatMessage, type BattleChatRoom, type PendingBattleChat } from "./battle-chat-messages";

export function useBattleChat(messages: BattleChatMessage[], room: BattleChatRoom | undefined, userId: string, name: string) {
  const key = room ? `${room.mode}:${room.code}` : "";
  const [received, setReceived] = useState<{ key: string; messages: BattleChatMessage[] }>({ key: "", messages: [] });
  const [pending, setPending] = useState<{ key: string; messages: PendingBattleChat[] }>({ key: "", messages: [] });
  const liveKey = useRef(key); liveKey.current = key;
  const confirmed = mergeBattleChatMessages(messages, received.key === key ? received.messages : []);
  const confirmationKey = confirmed.map(message => message.id).join("|");
  useEffect(() => {
    setPending(current => {
      if (current.key !== key || !current.messages.length) return current;
      const visible = new Set(visibleBattleChat(confirmed, current.messages).map(message => message.id));
      const remaining = current.messages.filter(message => visible.has(message.id));
      return remaining.length === current.messages.length ? current : { key, messages: remaining };
    });
    // IDs acknowledge pending messages once; later history truncation cannot resurrect them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, confirmationKey]);
  useEffect(() => {
    if (!room?.code) return;
    let active = true, running = false, queued = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (!active || document.hidden) return;
      if (running) { queued = true; return; }
      running = true;
      try {
        const response = await fetch(`/api/battle-chat?mode=${room.mode}&room=${encodeURIComponent(room.code)}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
        if (!response.ok) return;
        const data = await response.json();
        if (active && Array.isArray(data.messages)) setReceived(current => ({ key, messages: mergeBattleChatMessages(current.key === key ? current.messages : [], data.messages) }));
      } catch { /* Authenticated room polling remains the recovery path. */ }
      finally { running = false; if (active && queued) { queued = false; void refresh(); } }
    };
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<BattleChatRoom>).detail;
      if (detail?.code === room.code && detail.mode === room.mode) void refresh();
    };
    const visible = () => { if (!document.hidden) void refresh(); };
    window.addEventListener(BATTLE_CHAT_CHANGED, changed);
    document.addEventListener("visibilitychange", visible);
    void refresh();
    return () => { active = false; controller.abort(); window.removeEventListener(BATTLE_CHAT_CHANGED, changed); document.removeEventListener("visibilitychange", visible); };
  }, [key, room?.code, room?.mode]);

  const send = async (text: string, submit: () => void | Promise<boolean | void>) => {
    const id = `pending-${crypto.randomUUID()}`;
    const item: PendingBattleChat = { id, senderId: userId, senderName: name || "คุณ", text: text.trim().replace(/\s+/g, " ").slice(0, 240), createdAt: Date.now(), baseline: new Set(confirmed.map(message => message.id)) };
    setPending(current => ({ key, messages: [...(current.key === key ? current.messages : []), item].slice(-40) }));
    let ok = false;
    try { ok = (await submit()) !== false; } catch { /* Keep a visible failure instead of losing the message. */ }
    if (liveKey.current !== key) return;
    if (!ok) setPending(current => current.key !== key ? current : { key, messages: current.messages.map(message => message.id === id ? { ...message, failed: true } : message) });
    if (room) window.dispatchEvent(new CustomEvent(BATTLE_CHAT_CHANGED, { detail: room }));
  };
  return { messages: visibleBattleChat(confirmed, pending.key === key ? pending.messages : []), send };
}
