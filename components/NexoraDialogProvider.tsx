"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { playGameUiSound } from "@/lib/game-ui-audio";
import "./BattleSurrenderDialog.css";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import type {
  NexoraAlertOptions,
  NexoraConfirmOptions,
  NexoraDialogApi,
  NexoraDialogTone,
  NexoraPromptOptions,
} from "@/lib/nexora-dialog";

type DialogKind = "alert" | "confirm" | "prompt";

type DialogRequest = {
  appearance?: "battle-surrender";
  kind: DialogKind;
  title?: string;
  message: string;
  tone: NexoraDialogTone;
  confirmText: string;
  cancelText: string;
  defaultValue: string;
  placeholder: string;
  inputMode: "text" | "numeric" | "decimal" | "tel" | "email" | "url";
  resolve: (value: boolean | string | null | void) => void;
};

const toneConfig: Record<
  NexoraDialogTone,
  {
    eyebrow: string;
    iconClass: string;
    confirmClass: string;
    glowClass: string;
    Icon: typeof Info;
  }
> = {
  info: {
    eyebrow: "NEXORA TCG",
    iconClass: "border-cyan-200/20 bg-cyan-400/12 text-cyan-100",
    confirmClass:
      "border-cyan-200/20 bg-cyan-300 text-black shadow-[0_18px_44px_rgba(103,232,249,0.22)]",
    glowClass: "rgba(103,232,249,0.22)",
    Icon: Sparkles,
  },
  success: {
    eyebrow: "SUCCESS",
    iconClass: "border-emerald-200/20 bg-emerald-400/12 text-emerald-100",
    confirmClass:
      "border-emerald-200/20 bg-emerald-300 text-black shadow-[0_18px_44px_rgba(110,231,183,0.22)]",
    glowClass: "rgba(110,231,183,0.22)",
    Icon: CheckCircle2,
  },
  warning: {
    eyebrow: "CHECK",
    iconClass: "border-amber-200/20 bg-amber-400/12 text-amber-100",
    confirmClass:
      "border-amber-200/22 bg-amber-300 text-black shadow-[0_18px_44px_rgba(251,191,36,0.24)]",
    glowClass: "rgba(251,191,36,0.22)",
    Icon: AlertTriangle,
  },
  danger: {
    eyebrow: "CONFIRM",
    iconClass: "border-red-200/20 bg-red-500/14 text-red-100",
    confirmClass:
      "border-red-200/24 bg-red-500 text-white shadow-[0_18px_44px_rgba(239,68,68,0.28)]",
    glowClass: "rgba(239,68,68,0.25)",
    Icon: ShieldAlert,
  },
};

function normalizeMessage(value: unknown) {
  if (value instanceof Error) {
    return value.message;
  }

  const message = String(value ?? "").trim();
  return message || "ดำเนินการเรียบร้อย";
}

function isDangerMessage(message: string) {
  return /ลบ|ยกเลิก|delete|remove|cancel/i.test(message);
}

function isFailureMessage(message: string) {
  return /ไม่สำเร็จ|ไม่พอ|ผิดพลาด|ล้มเหลว|ไม่ถูกต้อง|failed|failure|fail|error|invalid/i.test(
    message
  );
}

function isSuccessMessage(message: string) {
  if (isFailureMessage(message)) {
    return false;
  }

  return /สำเร็จ|success|เรียบร้อย/i.test(message);
}

function inferTone(message: string, preferred?: NexoraDialogTone) {
  if (preferred) return preferred;
  if (isFailureMessage(message)) return "danger";
  if (isDangerMessage(message)) return "danger";
  if (isSuccessMessage(message)) return "success";
  return "info";
}

export default function NexoraDialogProvider() {
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState<DialogRequest | null>(null);
  const [inputValue, setInputValue] = useState("");
  const currentRef = useRef<DialogRequest | null>(null);
  const queueRef = useRef<DialogRequest[]>([]);

  const flushQueue = useCallback(() => {
    if (currentRef.current) return;

    const next = queueRef.current.shift() || null;
    currentRef.current = next;
    setCurrent(next);
    setInputValue(next?.defaultValue || "");
    if (next?.appearance === "battle-surrender") playGameUiSound("back");
  }, []);

  const openDialog = useCallback(
    <T,>(
      options:
        | (NexoraAlertOptions & { kind: "alert" })
        | (NexoraConfirmOptions & { kind: "confirm" })
        | (NexoraPromptOptions & { kind: "prompt" })
    ) =>
      new Promise<T>((resolve) => {
        const message = normalizeMessage(options.message);
        const tone = inferTone(message, options.tone);

        queueRef.current.push({
          appearance: options.kind === "confirm" && ["ยืนยันยอมแพ้?", "ยืนยันออกจากห้อง?"].includes(options.title || "") ? "battle-surrender" : undefined,
          kind: options.kind,
          title:
            options.title ||
            (options.kind === "prompt"
              ? "กรอกข้อมูล"
              : options.kind === "confirm"
                ? "ยืนยันการทำรายการ"
                : isFailureMessage(message)
                  ? "ไม่สำเร็จ"
                : isSuccessMessage(message)
                  ? "สำเร็จ"
                  : "แจ้งเตือน"),
          message,
          tone,
          confirmText: options.confirmText || "ตกลง",
          cancelText: "cancelText" in options && options.cancelText ? options.cancelText : "ยกเลิก",
          defaultValue: "defaultValue" in options ? options.defaultValue || "" : "",
          placeholder: "placeholder" in options ? options.placeholder || "" : "",
          inputMode: "inputMode" in options ? options.inputMode || "text" : "text",
          resolve: resolve as DialogRequest["resolve"],
        });

        flushQueue();
      }),
    [flushQueue]
  );

  const closeDialog = useCallback(
    (value: boolean | string | null | void) => {
      const active = currentRef.current;
      if (!active) return;
      if (active.appearance === "battle-surrender") playGameUiSound(value === true ? "confirm" : "back");

      active.resolve(value);
      currentRef.current = null;
      setCurrent(null);
      setInputValue("");
      window.setTimeout(flushQueue, 0);
    },
    [flushQueue]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const api: NexoraDialogApi = {
      alert: (options) =>
        openDialog<void>({
          ...options,
          kind: "alert",
        }),
      confirm: (options) =>
        openDialog<boolean>({
          ...options,
          kind: "confirm",
        }),
      prompt: (options) =>
        openDialog<string | null>({
          ...options,
          kind: "prompt",
        }),
    };

    const originalAlert = window.alert.bind(window);
    window.nexoraDialog = api;
    window.alert = (message?: unknown) => {
      void api.alert({
        message: normalizeMessage(message),
      });
    };

    return () => {
      if (window.nexoraDialog === api) {
        delete window.nexoraDialog;
      }

      window.alert = originalAlert;
    };
  }, [mounted, openDialog]);

  useEffect(() => {
    if (!current) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog(current.kind === "alert" ? undefined : current.kind === "confirm" ? false : null);
      }

      if (event.key === "Enter" && current.kind !== "alert" && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        closeDialog(current.kind === "prompt" ? inputValue : true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (current.appearance === "battle-surrender" && previousFocus instanceof HTMLElement) previousFocus.focus();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDialog, current, inputValue]);

  if (!mounted || !current) {
    return null;
  }

  const tone = toneConfig[current.tone];
  const Icon = tone.Icon;

  if (current.appearance === "battle-surrender") {
    return createPortal(<div className="nexora-surrender-backdrop" onClick={event => { if (event.target === event.currentTarget) closeDialog(false); }}>
      <section className="nexora-surrender-dialog" role="alertdialog" aria-modal="true" aria-labelledby="surrender-title" aria-describedby="surrender-description" onKeyDown={event => {
        if (event.key !== "Tab") return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
        <div className="nexora-surrender-heading"><ShieldAlert size={32} /><span>NEXORA · BATTLE</span><button type="button" aria-label="ปิดหน้าต่างยอมแพ้" onClick={() => closeDialog(false)}><X size={20} /></button></div>
        <h2 id="surrender-title">{current.title}</h2>
        <p id="surrender-description">{current.message}</p>
        <div className="nexora-surrender-actions"><button type="button" autoFocus onClick={() => closeDialog(false)}>{current.cancelText}</button><button type="button" className="nexora-surrender-confirm" onClick={() => closeDialog(true)}><ShieldAlert size={18} />{current.confirmText}</button></div>
      </section>
    </div>, document.body);
  }

  const modal = (
    <div className="fixed inset-0 z-[99999] flex items-end justify-center overflow-hidden bg-black/72 px-3 py-[max(14px,env(safe-area-inset-top))] pb-[max(14px,env(safe-area-inset-bottom))] backdrop-blur-xl sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="ปิดหน้าต่าง"
        className="absolute inset-0"
        onClick={() =>
          closeDialog(current.kind === "alert" ? undefined : current.kind === "confirm" ? false : null)
        }
      />

      <div className="relative w-full max-w-[460px] overflow-hidden rounded-[28px] border border-white/12 bg-[#07080d] text-white shadow-[0_34px_140px_rgba(0,0,0,0.78)] sm:rounded-[32px]">
        <div
          className="pointer-events-none absolute inset-0 opacity-95"
          style={{
            background: `radial-gradient(circle at 18% 0%, ${tone.glowClass}, transparent 34%), radial-gradient(circle at 90% 12%, rgba(255,255,255,0.12), transparent 28%)`,
          }}
        />
        <div className="relative p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] shadow-[0_0_42px_rgba(255,255,255,0.06)] ${tone.iconClass}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/42">
                  {tone.eyebrow}
                </div>
                <div className="mt-1 text-xl font-black leading-tight sm:text-2xl">
                  {current.title}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                closeDialog(current.kind === "alert" ? undefined : current.kind === "confirm" ? false : null)
              }
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70 transition hover:bg-white/[0.1] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 rounded-[22px] border border-white/8 bg-white/[0.045] px-4 py-4 text-sm font-semibold leading-6 text-white/72">
            {current.message}
          </div>

          {current.kind === "prompt" ? (
            <input
              autoFocus
              value={inputValue}
              inputMode={current.inputMode}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={current.placeholder}
              className="mt-4 h-14 w-full rounded-[20px] border border-white/10 bg-black/36 px-4 text-base font-bold text-white outline-none transition placeholder:text-white/28 focus:border-cyan-200/35 focus:ring-4 focus:ring-cyan-300/10"
            />
          ) : null}

          <div
            className={`mt-5 grid gap-3 ${
              current.kind === "alert" ? "" : "sm:grid-cols-2"
            }`}
          >
            {current.kind !== "alert" ? (
              <button
                type="button"
                onClick={() => closeDialog(current.kind === "confirm" ? false : null)}
                className="min-h-[48px] rounded-[18px] border border-white/10 bg-white/[0.055] px-4 text-sm font-black text-white/78 transition hover:bg-white/[0.09]"
              >
                {current.cancelText}
              </button>
            ) : null}

            <button
              type="button"
              autoFocus={current.kind !== "prompt"}
              onClick={() =>
                closeDialog(
                  current.kind === "prompt"
                    ? inputValue
                    : current.kind === "confirm"
                      ? true
                      : undefined
                )
              }
              className={`min-h-[48px] rounded-[18px] px-4 text-sm font-black transition hover:brightness-110 ${tone.confirmClass}`}
            >
              {current.confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
