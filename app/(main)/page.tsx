"use client";

import Image from "next/image";
import { Noto_Sans_Thai } from "next/font/google";
import { useEffect, useState } from "react";
import AppInstallButton from "@/components/AppInstallButton";
import AppStoreButton from "@/components/AppStoreButton";
import GooglePlayButton from "@/components/GooglePlayButton";
import PrefetchLink from "@/components/PrefetchLink";
import WindowsDownloadButton from "@/components/WindowsDownloadButton";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["500", "700", "800", "900"],
});

const heroPills = ["สะสม +", "ต่อสู้ +", "แลกเปลี่ยน +", "รับรางวัล +"];

export default function NexoraLuxuryHome() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let frameId = 0;

    const move = (event: MouseEvent) => {
      if (frameId) return;

      frameId = window.requestAnimationFrame(() => {
        setMouse({
          x: (event.clientX / window.innerWidth - 0.5) * 26,
          y: (event.clientY / window.innerHeight - 0.5) * 18,
        });
        frameId = 0;
      });
    };

    window.addEventListener("mousemove", move);

    return () => {
      window.removeEventListener("mousemove", move);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return (
    <section
      className={`relative min-h-[calc(var(--app-shell-height)-140px)] overflow-hidden rounded-[28px] border border-black/8 bg-[#f7f4ee] text-black shadow-[0_32px_90px_rgba(24,24,24,0.12)] sm:rounded-[36px] ${notoSansThai.className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.18),transparent_18%),linear-gradient(180deg,#fbfaf7_0%,#f2eee6_100%)]" />
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "url(https://r4.wallpaperflare.com/wallpaper/976/74/465/multiple-display-mountains-snow-nature-wallpaper-c1b4ba2a902ec5b27032d3c4aefe604d.jpg)",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,rgba(247,244,238,0)_0%,rgba(0,0,0,0.06)_68%,rgba(0,0,0,0.14)_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.86)_32%,rgba(255,255,255,0.32)_56%,rgba(255,255,255,0.06)_76%,rgba(255,255,255,0)_100%)]" />

      <div className="relative z-30 px-4 pt-5 sm:hidden">
        <div className="flex justify-end">
          <div className="max-w-[118px] text-right text-[0.8rem] font-bold leading-[1.1] tracking-[0.02em] text-black/56">
            ประสบการณ์ระดับเวิลด์คลาส
          </div>
        </div>

        <div className="mt-1 pr-2 text-[21.5vw] font-black uppercase leading-[0.86] tracking-[-0.075em] text-black/[0.97]">
          NEXORA
        </div>

        <div className="mt-4 flex justify-center">
          <AppInstallButton variant="dark" />
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <WindowsDownloadButton />
          <GooglePlayButton />
          <AppStoreButton />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {heroPills.map((item) => (
            <span
              key={item}
              className="rounded-full border border-black/10 bg-white/78 px-3 py-2 text-[10px] font-black tracking-[0.08em] text-black/74 shadow-[0_12px_28px_rgba(0,0,0,0.08)] backdrop-blur-xl"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="relative z-20 px-4 pb-[calc(env(safe-area-inset-bottom)+112px)] sm:hidden">
        <div className="relative mt-1 flex min-h-[210px] items-end justify-center overflow-hidden">
          <Image
            src="https://s.imgz.io/2026/03/24/033-97ca7d23f8ddf07a.png"
            alt="Nexora hero"
            width={820}
            height={1093}
            priority
            sizes="90vw"
            className="h-[31svh] max-h-[300px] min-h-[205px] w-auto translate-x-[5%] object-contain drop-shadow-[0_18px_44px_rgba(0,0,0,0.18)]"
          />
        </div>

        <div className="relative z-10 -mt-2 rounded-[26px] border border-black/8 bg-white/86 p-4 shadow-[0_22px_52px_rgba(0,0,0,0.12)] backdrop-blur-xl">
          <div className="text-[12px] font-extrabold leading-5 tracking-[0.06em] text-amber-800">
            สะสม ต่อสู้ แลกเปลี่ยน และรับรางวัลในจักรวาล NEXORA
          </div>
          <div className="mt-2 text-[clamp(1.05rem,5.3vw,1.38rem)] font-extrabold leading-[1.2] tracking-[-0.03em] text-black/84">
            ก้าวเข้าสู่ยุคใหม่ของการ์ดสะสมระดับพรีเมียม ด้วยตลาดที่ไวระดับโลก
          </div>
          <div className="mt-2 text-[0.92rem] font-semibold leading-6 text-black/58">
            แชทเรียลไทม์ ซื้อขายลื่นไหลบนมือถือ คอม และเว็บแอพในประสบการณ์เดียวกัน
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <PrefetchLink
              href="/market"
              className="rounded-2xl bg-black px-5 py-3 text-sm font-black text-white shadow-[0_18px_32px_rgba(0,0,0,0.16)] transition active:scale-[0.98]"
            >
              เข้าสู่ตลาด
            </PrefetchLink>
            <PrefetchLink
              href="/community"
              className="rounded-2xl border border-black/12 bg-white/74 px-5 py-3 text-sm font-black text-black backdrop-blur-xl transition active:scale-[0.98]"
            >
              คอมมูนิตี้
            </PrefetchLink>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-4 top-3 z-10 hidden text-[22vw] font-black uppercase leading-none tracking-[-0.065em] text-black/[0.96] sm:left-8 sm:top-5 sm:block lg:text-[18vw]">
        NEXORA
      </div>

      <div className="absolute right-4 top-4 z-30 hidden max-w-[170px] text-right text-[1rem] font-bold leading-[1.08] tracking-[0.02em] text-black/56 sm:right-8 sm:top-8 sm:block lg:max-w-[230px] lg:text-[1.35rem]">
        ประสบการณ์ระดับเวิลด์คลาส
      </div>

      <div className="absolute left-8 top-[33%] z-30 hidden max-w-[620px] flex-wrap gap-3 text-sm font-black tracking-[0.12em] text-black/74 sm:flex">
        {heroPills.map((item) => (
          <span
            key={item}
            className="rounded-full border border-black/10 bg-white/72 px-3 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.08)] backdrop-blur-xl"
          >
            {item}
          </span>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-8 bottom-10 z-40 hidden justify-center gap-3 sm:flex">
        <AppInstallButton variant="dark" />
        <WindowsDownloadButton />
        <GooglePlayButton />
        <AppStoreButton />
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-20 hidden justify-center transition-transform duration-300 sm:flex"
        style={{ transform: `translate(${mouse.x}px, ${mouse.y}px)` }}
      >
        <Image
          src="https://s.imgz.io/2026/03/24/033-97ca7d23f8ddf07a.png"
          alt="Nexora hero"
          width={1200}
          height={1600}
          priority
          sizes="(max-width: 640px) 84vw, (max-width: 1024px) 64vw, 54vw"
          className="h-[48dvh] w-auto translate-x-[11%] object-contain drop-shadow-[0_18px_50px_rgba(0,0,0,0.20)] sm:h-[80dvh] sm:translate-x-0 lg:h-[86dvh]"
        />
      </div>

      <div className="hidden sm:absolute sm:bottom-10 sm:left-8 sm:z-30 sm:block sm:max-w-[560px] sm:pr-0">
        <div className="max-w-[330px] text-[13px] font-extrabold tracking-[0.06em] text-amber-800 sm:max-w-[520px] sm:text-lg">
          สะสม ต่อสู้ แลกเปลี่ยน และรับรางวัลในจักรวาล NEXORA
        </div>

        <div className="relative mt-3 max-w-[320px] sm:max-w-[650px]">
          <div className="pointer-events-none absolute inset-x-[-10px] inset-y-[-8px] rounded-[28px] bg-white/78 blur-2xl sm:inset-x-[-18px] sm:inset-y-[-12px] sm:bg-white/50" />
          <div className="relative text-[1.08rem] font-extrabold leading-[1.18] tracking-[-0.045em] text-black/80 sm:text-[2.1rem] sm:leading-[1.28] lg:text-[2.55rem]">
            ก้าวเข้าสู่ยุคใหม่ของการ์ดสะสมระดับพรีเมียม ด้วยตลาดที่ไวระดับโลก
          </div>
        </div>

        <div className="mt-1.5 max-w-[330px] text-[0.98rem] font-semibold leading-[1.36] tracking-[0.01em] text-black/58 sm:mt-3 sm:max-w-[560px] sm:text-[1.02rem] sm:leading-6 lg:text-[1.08rem]">
          แชทเรียลไทม์ การครอบครองที่มีคุณค่า และรางวัลที่ยกระดับทุกคอลเลกชันของคุณ ซื้อขายลื่นไหลบนมือถือ คอม และเว็บแอพในประสบการณ์เดียวกัน
        </div>
        <div className="mt-1 max-w-[330px] text-[0.96rem] font-semibold leading-[1.36] text-black/54 sm:max-w-[520px] sm:text-[1rem] sm:leading-6">
          
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <PrefetchLink
            href="/market"
            className="rounded-2xl bg-black px-6 py-3 text-sm font-black text-white shadow-[0_18px_32px_rgba(0,0,0,0.16)] transition hover:scale-[1.03] hover:bg-black/88"
          >
            เข้าสู่ตลาด
          </PrefetchLink>
          <PrefetchLink
            href="/community"
            className="rounded-2xl border border-black/12 bg-white/72 px-6 py-3 text-sm font-black text-black backdrop-blur-xl transition hover:scale-[1.03] hover:bg-white"
          >
            คอมมูนิตี้
          </PrefetchLink>
        </div>
      </div>
    </section>
  );
}
