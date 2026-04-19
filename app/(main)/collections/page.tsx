import Link from "next/link";
import {
  ArrowRight,
  Layers3,
  ScanSearch,
  Sparkles,
  Trophy,
} from "lucide-react";
import CardScannerPanel from "@/components/CardScannerPanel";

export const dynamic = "force-dynamic";

export default function CollectionsPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a1238_0%,#090b12_42%,#05070d_100%)] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.1),transparent_22%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(19,17,31,0.98),rgba(12,13,20,0.94))] p-4 shadow-[0_25px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:rounded-[34px] sm:p-6 xl:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-violet-100 sm:text-xs">
                <Layers3 className="h-3.5 w-3.5" />
                NEXORA COLLECTIONS
              </div>

              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl xl:text-5xl">
                สะสมการ์ดและสแกนเข้าชุดได้จากหน้าเดียว
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 sm:text-base sm:leading-7">
                ใช้กล้องสแกนการ์ดเพื่อให้ระบบตรวจจับหมายเลขการ์ด ชุดสะสม
                และรางวัลที่เกี่ยวข้องได้ทันทีแบบบาลานซ์ทั้งมือถือและเดสก์ท็อป
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
              <div className="rounded-[26px] border border-cyan-300/12 bg-cyan-300/10 p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-cyan-200/70">
                  <ScanSearch className="h-3.5 w-3.5" />
                  Smart Scan
                </div>
                <div className="mt-2 text-2xl font-black text-cyan-300">
                  Hybrid AI
                </div>
              </div>

              <div className="rounded-[26px] border border-emerald-300/12 bg-emerald-300/10 p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-emerald-200/70">
                  <Sparkles className="h-3.5 w-3.5" />
                  Matching
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-300">
                  Fast First
                </div>
              </div>

              <div className="rounded-[26px] border border-amber-300/12 bg-amber-300/10 p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-amber-200/70">
                  <Trophy className="h-3.5 w-3.5" />
                  Rewards
                </div>
                <div className="mt-2 text-2xl font-black text-amber-300">
                  Collection
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="min-w-0">
            <CardScannerPanel />
          </div>

          <div className="space-y-4">
            <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,19,29,0.98),rgba(13,15,24,0.92))] p-5 shadow-[0_14px_60px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
              <div className="text-[10px] uppercase tracking-[0.28em] text-white/35">
                HOW IT WORKS
              </div>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">
                สแกนได้เร็วขึ้นยังไง
              </h2>

              <div className="mt-5 space-y-3">
                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="text-sm font-black text-white">1. รอบเร็วในเครื่อง</div>
                  <div className="mt-2 text-sm leading-6 text-white/55">
                    ระบบจับภาพเฉพาะโซนการ์ดแล้วตรวจแบบ local matching ก่อน
                    ถ้าความมั่นใจสูงพอจะตอบทันทีเพื่อลดเวลารอ
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="text-sm font-black text-white">2. AI ช่วยเมื่อยังไม่ชัวร์</div>
                  <div className="mt-2 text-sm leading-6 text-white/55">
                    ถ้ารอบเร็วไม่มั่นใจพอ ระบบจะส่งภาพที่บีบแล้วไปวิเคราะห์ด้วย AI
                    ต่อทันทีเพื่อดึงความแม่นยำขึ้น
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="text-sm font-black text-white">3. ดึงข้อมูลการ์ดจริง</div>
                  <div className="mt-2 text-sm leading-6 text-white/55">
                    เมื่อรู้หมายเลขการ์ดแล้ว ระบบจะโหลดชื่อการ์ด ชุดสะสม
                    และรางวัลที่เกี่ยวข้องจากฐานข้อมูลกลางทันที
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,19,29,0.98),rgba(13,15,24,0.92))] p-5 shadow-[0_14px_60px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
              <div className="text-[10px] uppercase tracking-[0.28em] text-white/35">
                QUICK ACTIONS
              </div>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">
                ไปต่ออย่างรวดเร็ว
              </h2>

              <div className="mt-5 space-y-3">
                <Link
                  href="/scan"
                  className="flex items-center justify-between rounded-[24px] border border-cyan-300/12 bg-cyan-300/10 px-4 py-4 transition hover:bg-cyan-300/14"
                >
                  <div>
                    <div className="text-base font-black text-cyan-200">
                      เปิดโหมดสแกนเต็มจอ
                    </div>
                    <div className="mt-1 text-sm text-cyan-100/60">
                      เหมาะกับการสแกนต่อเนื่องแบบโฟกัสเต็มพื้นที่กล้อง
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-cyan-200" />
                </Link>

                <Link
                  href="/rewards"
                  className="flex items-center justify-between rounded-[24px] border border-amber-300/12 bg-amber-300/10 px-4 py-4 transition hover:bg-amber-300/14"
                >
                  <div>
                    <div className="text-base font-black text-amber-200">
                      ดูรางวัลที่มีในระบบ
                    </div>
                    <div className="mt-1 text-sm text-amber-100/60">
                      ไปต่อที่หน้า rewards เพื่อดูรางวัลและคูปองที่พร้อมแลก
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-amber-200" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
