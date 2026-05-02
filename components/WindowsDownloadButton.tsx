"use client";

import { CheckCircle2, Download, MonitorDown } from "lucide-react";
import { useSyncExternalStore } from "react";

type DesktopBridgeWindow = Window & {
  nexoraDesktop?: {
    isDesktop?: boolean;
  };
};

function subscribeDesktopBridge() {
  return () => {};
}

function getDesktopBridgeSnapshot() {
  return Boolean((window as DesktopBridgeWindow).nexoraDesktop?.isDesktop);
}

function getServerDesktopBridgeSnapshot() {
  return false;
}

export default function WindowsDownloadButton() {
  const isDesktopApp = useSyncExternalStore(
    subscribeDesktopBridge,
    getDesktopBridgeSnapshot,
    getServerDesktopBridgeSnapshot
  );

  if (isDesktopApp) {
    return (
      <div className="pointer-events-auto inline-flex min-h-[54px] items-center gap-3 rounded-[22px] border border-emerald-400/18 bg-emerald-400/12 px-5 py-3 text-sm font-black text-emerald-950 shadow-[0_18px_36px_rgba(16,185,129,0.14)] backdrop-blur-xl">
        <CheckCircle2 className="h-5 w-5" />
        Windows App Active
      </div>
    );
  }

  return (
    <a
      href="/downloads/windows/NEXORA-Point-Setup.exe"
      download
      className="pointer-events-auto group inline-flex min-h-[54px] items-center gap-3 overflow-hidden rounded-[22px] border border-black/12 bg-[linear-gradient(180deg,#111318_0%,#050507_100%)] px-5 py-3 text-sm font-black text-white shadow-[0_20px_46px_rgba(0,0,0,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_26px_62px_rgba(0,0,0,0.30)]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.08] text-amber-200">
        <MonitorDown className="h-5 w-5" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="tracking-[0.08em]">DOWNLOAD WINDOWS</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/58">
          Auto Update
        </span>
      </span>
      <Download className="h-4 w-4 text-white/54 transition group-hover:text-white" />
    </a>
  );
}
