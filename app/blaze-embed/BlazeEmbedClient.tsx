"use client";

import { Maximize2, Send, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type BlazeMessage = {
  id: string;
  role: "user" | "model";
  text: string;
  createdAt: string;
};

const BLAZE_AVATAR_URL = "https://s.imgz.io/2026/03/20/158-39efa94028226fea.png";
const STORAGE_KEY = "nexora:blaze-embed-session:v1";
const WELCOME_MESSAGE: BlazeMessage = {
  id: "welcome",
  role: "model",
  text:
    "สวัสดี ข้าคือท่านเบลซ Blaze Warlock ผู้ช่วยประจำโลก NEXORA ถามเรื่องการ์ด ตลาด ระบบ หรือเรื่องทั่วไปมาได้เลย ข้าจะช่วยตอบให้ชัดที่สุด",
  createdAt: new Date(0).toISOString(),
};

function safeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeStoredMessage(value: unknown): BlazeMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const role = record.role === "user" || record.role === "model" ? record.role : null;
  const text = safeText(record.text);

  if (!role || !text) {
    return null;
  }

  const createdAt = safeText(record.createdAt) || new Date().toISOString();

  return {
    id: safeText(record.id) || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    createdAt,
  };
}

function readSession() {
  if (typeof window === "undefined") {
    return {
      messages: [WELCOME_MESSAGE],
      draft: "",
    };
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        messages: [WELCOME_MESSAGE],
        draft: "",
      };
    }

    const parsed = JSON.parse(raw) as { messages?: unknown; draft?: unknown };
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.map(normalizeStoredMessage).filter(Boolean)
      : [];

    return {
      messages: [WELCOME_MESSAGE, ...(messages as BlazeMessage[]).filter((item) => item.id !== "welcome")],
      draft: typeof parsed.draft === "string" ? parsed.draft : "",
    };
  } catch {
    return {
      messages: [WELCOME_MESSAGE],
      draft: "",
    };
  }
}

function makeClientId() {
  if (typeof window === "undefined") {
    return "nexora-embed";
  }

  const key = "nexora:blaze-embed-client-id";
  const existing = window.localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const next = `embed-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(key, next);
  return next;
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BlazeEmbedClient() {
  const hydrated = useMemo(() => readSession(), []);
  const [messages, setMessages] = useState<BlazeMessage[]>(hydrated.messages);
  const [draft, setDraft] = useState(hydrated.draft);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const clientIdRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef(messages);

  useEffect(() => {
    clientIdRef.current = makeClientId();
  }, []);

  useEffect(() => {
    messagesRef.current = messages;

    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          messages: messages.filter((item) => item.id !== "welcome").slice(-80),
          draft,
          savedAt: new Date().toISOString(),
        })
      );
    } catch {
      // Keep the in-memory chat alive even if the iframe browser blocks storage.
    }
  }, [draft, messages]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, sending]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
  }, [draft]);

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const text = safeText(draft);
    if (!text || sending) {
      return;
    }

    const userMessage: BlazeMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
      createdAt: new Date().toISOString(),
    };
    const history = messagesRef.current
      .filter((item) => item.id !== "welcome")
      .slice(-10)
      .map((item) => ({
        role: item.role,
        text: item.text,
      }));

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setError("");
    setSending(true);

    try {
      const response = await fetch("/api/blaze-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          history,
          clientId: clientIdRef.current || "nexora-embed",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error || "Blaze AI did not return text");
      }

      setMessages((current) => [
        ...current,
        {
          id: `model-${Date.now()}`,
          role: "model",
          text: payload.reply || "ข้าพร้อมแล้ว ถามท่านเบลซมาได้เลย",
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message
          ? caught.message
          : "เชื่อมต่อไม่สำเร็จ";
      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "model",
          text: `ข้าเชื่อมต่อไม่สำเร็จ: ${message}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <main className="fixed inset-0 isolate flex min-h-[100dvh] flex-col overflow-hidden bg-[#050403] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(250,204,21,0.16),transparent_26%),radial-gradient(circle_at_92%_6%,rgba(168,85,247,0.18),transparent_24%),linear-gradient(180deg,#070604_0%,#0b0906_46%,#050403_100%)]" />
      <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:32px_32px]" />

      <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-amber-200/12 bg-black/58 px-4 py-3 shadow-[0_18px_42px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:px-5">
        <img
          src={BLAZE_AVATAR_URL}
          alt="ท่านเบลซ"
          className="h-12 w-12 shrink-0 rounded-2xl border border-amber-200/26 object-cover shadow-[0_0_28px_rgba(245,158,11,0.22)] sm:h-14 sm:w-14"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-black leading-none text-white sm:text-2xl">
            ท่านเบลซ
          </div>
          <div className="mt-1 truncate text-xs font-extrabold text-amber-100/66 sm:text-sm">
            Blaze Warlock • NEXORA AI
          </div>
        </div>
        <a
          href="/blaze-embed"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-200/18 bg-white/[0.06] text-amber-100 shadow-[inset_0_0_18px_rgba(251,191,36,0.05)] transition hover:border-amber-100/34 hover:bg-amber-200/10"
          aria-label="เปิดท่านเบลซแบบเต็มจอ"
        >
          <Maximize2 className="h-5 w-5" />
        </a>
      </header>

      <section className="relative z-10 min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col justify-end">
          {messages.map((message) => {
            const mine = message.role === "user";

            return (
              <div
                key={message.id}
                className={`mb-3 flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
              >
                {!mine ? (
                  <img
                    src={BLAZE_AVATAR_URL}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full border border-amber-200/18 object-cover"
                  />
                ) : null}
                <div className={`min-w-0 ${mine ? "items-end" : "items-start"} flex max-w-[86%] flex-col`}>
                  {!mine ? (
                    <div className="mb-1 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100/45">
                      BLAZE WARLOCK
                    </div>
                  ) : null}
                  <div
                    className={
                      mine
                        ? "rounded-[24px] rounded-br-lg bg-white px-4 py-3 text-sm font-bold leading-7 text-black shadow-[0_14px_34px_rgba(0,0,0,0.22)] sm:text-[15px]"
                        : "rounded-[24px] rounded-bl-lg border border-amber-200/13 bg-[#171006]/92 px-4 py-3 text-sm font-bold leading-7 text-amber-50 shadow-[0_14px_34px_rgba(0,0,0,0.26)] sm:text-[15px]"
                    }
                  >
                    {message.text}
                  </div>
                  {message.id !== "welcome" ? (
                    <div className="mt-1 px-1 text-[10px] font-semibold text-amber-100/32">
                      {formatTime(message.createdAt)}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {sending ? (
            <div className="mb-3 flex items-end gap-2">
              <img
                src={BLAZE_AVATAR_URL}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full border border-amber-200/18 object-cover"
              />
              <div className="rounded-[22px] rounded-bl-lg border border-amber-200/13 bg-[#171006]/92 px-4 py-3 shadow-[0_14px_34px_rgba(0,0,0,0.26)]">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-100 [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-100 [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-100" />
                </div>
              </div>
            </div>
          ) : null}
          <div ref={scrollRef} />
        </div>
      </section>

      <form
        onSubmit={sendMessage}
        className="relative z-10 shrink-0 border-t border-amber-200/12 bg-black/70 px-3 py-3 backdrop-blur-xl sm:px-5"
      >
        <div className="mx-auto w-full max-w-[760px]">
          {error ? (
            <div className="mb-2 rounded-2xl border border-amber-200/16 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100">
              {error}
            </div>
          ) : null}
          <div className="flex items-end gap-2 rounded-[26px] border border-amber-200/16 bg-[#0c0a07]/88 p-2 shadow-[inset_0_0_20px_rgba(251,191,36,0.05)]">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              rows={1}
              inputMode="text"
              autoComplete="off"
              placeholder="ถามท่านเบลซ..."
              className="max-h-32 min-h-12 min-w-0 flex-1 resize-none rounded-[20px] border border-amber-100/10 bg-white/[0.06] px-4 py-3 text-sm font-bold leading-relaxed text-white outline-none placeholder:text-amber-100/34 focus:border-amber-100/34"
            />
            <button
              type="submit"
              disabled={!safeText(draft) || sending}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f8dc83_0%,#b3842d_100%)] text-black shadow-[0_14px_34px_rgba(245,158,11,0.26)] transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="ส่งข้อความ"
            >
              {sending ? <Sparkles className="h-5 w-5 animate-pulse" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px] font-extrabold text-amber-100/48">
            <span>Blaze Warlock • NEXORA AI</span>
            <span className="hidden sm:inline">iframe-safe mobile chat</span>
          </div>
        </div>
      </form>
    </main>
  );
}
