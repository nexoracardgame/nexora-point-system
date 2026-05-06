"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  IdCard,
  Phone,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import type { DealerVerificationStatus } from "@/lib/box-market-types";

type VerifyForm = {
  fullName: string;
  memberId: string;
  phone: string;
  nationalId: string;
  lineContactId: string;
  email: string;
};

const EMPTY_FORM: VerifyForm = {
  fullName: "",
  memberId: "",
  phone: "",
  nationalId: "",
  lineContactId: "",
  email: "",
};

function formatVerifiedAt(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function DealerVerifyClient() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState<DealerVerificationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const res = await fetch(`/api/box-market/verify?ts=${Date.now()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) {
          setStatus({ verified: false, status: "none", verifiedAt: null });
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(key: keyof VerifyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError("");
    setNotice("");

    if (!form.fullName || !form.memberId || !form.phone || !form.nationalId) {
      setError("กรอกข้อมูลจำเป็นให้ครบก่อนยืนยัน");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/box-market/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        setError(data?.error || "ยืนยันไม่สำเร็จ");
        return;
      }

      setStatus({
        verified: true,
        status: "verified",
        verifiedAt: data.verifiedAt || new Date().toISOString(),
      });
      setForm(EMPTY_FORM);
      setNotice("ยืนยันตัวแทนจำหน่ายสำเร็จแล้ว");
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างยืนยัน");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full text-black">
      <div className="mx-auto grid w-full max-w-6xl gap-5 pb-4 xl:grid-cols-[0.86fr_1.14fr]">
        <section className="rounded-[28px] bg-[#050506] p-5 text-white shadow-[0_24px_90px_rgba(0,0,0,0.34)] ring-1 ring-white/10 sm:p-7">
          <Link
            href="/box-market"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-white/72 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            กลับตลาดกล่องสุ่ม
          </Link>

          <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-[22px] bg-white text-black">
            <ShieldCheck className="h-7 w-7" />
          </div>

          <h1 className="mt-6 text-[34px] font-black leading-none sm:text-5xl">
            ยืนยันตัวแทนจำหน่าย
          </h1>
          <p className="mt-4 text-sm font-medium leading-7 text-white/62 sm:text-base">
            ระบบจะเทียบข้อมูลกับฐานข้อมูลตัวแทนจำหน่ายในบริษัทจริง
            เมื่อผ่านแล้วสินค้าที่ลงขายใหม่ในร้านขายซอง/กล่องการ์ดแท้จะมีเครื่องหมายยืนยัน
          </p>

          <div className="mt-8 rounded-[24px] border border-white/8 bg-white/[0.055] p-4">
            {status?.verified ? (
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-300 text-black">
                  <BadgeCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-black">สถานะผ่านการยืนยัน</div>
                  <div className="mt-1 text-sm font-medium text-white/50">
                    {formatVerifiedAt(status.verifiedAt)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                  <UserRoundCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-black">ยังไม่ได้ยืนยัน</div>
                  <div className="mt-1 text-sm font-medium text-white/50">
                    กรอกข้อมูลตัวแทนเพื่อเปิดตรายืนยันบนรายการขาย
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <form
          onSubmit={submit}
          className="rounded-[28px] border border-black/8 bg-white p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-black/42">
                Dealer Form
              </div>
              <h2 className="mt-1 text-2xl font-black">ข้อมูลตัวแทน</h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="max-w-xl text-sm font-bold leading-6 text-black/50">
                  ต้องเป็นข้อมูลจริงที่ได้รับการลงทะเบียนกับบริษัทเป็นทางการเท่านั้น
                </p>
                <a
                  href="https://www.nexoracardgame.com/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center justify-center rounded-full bg-black px-4 py-2 text-xs font-black text-white transition hover:bg-zinc-800"
                >
                  ดูรายละเอียด
                </a>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-white">
              <IdCard className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-black text-black/62">
                ชื่อ-นามสกุล
              </span>
              <input
                value={form.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                autoComplete="name"
                className="w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-black/35"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black text-black/62">
                รหัสสมาชิก
              </span>
              <input
                value={form.memberId}
                onChange={(event) => updateField("memberId", event.target.value)}
                className="w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-black/35"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-black text-black/62">
                <Phone className="h-3.5 w-3.5" />
                เบอร์มือถือ
              </span>
              <input
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                className="w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-black/35"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black text-black/62">
                เลขบัตรประชาชน
              </span>
              <input
                value={form.nationalId}
                onChange={(event) => updateField("nationalId", event.target.value)}
                inputMode="text"
                autoComplete="off"
                className="w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-black/35"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black text-black/62">
                ID Line
              </span>
              <input
                value={form.lineContactId}
                onChange={(event) =>
                  updateField("lineContactId", event.target.value)
                }
                className="w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-black/35"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black text-black/62">
                E-mail
              </span>
              <input
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                inputMode="email"
                autoComplete="email"
                className="w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-black/35"
              />
            </label>
          </div>

          {(notice || error) && (
            <div
              className={`mt-5 rounded-[18px] px-4 py-3 text-sm font-bold ${
                error
                  ? "bg-red-500/10 text-red-700"
                  : "bg-emerald-500/10 text-emerald-700"
              }`}
            >
              {error || notice}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-[20px] bg-black px-4 py-4 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <BadgeCheck className="h-4 w-4" />
            {loading ? "กำลังตรวจสอบ..." : "ยืนยันตัวแทนจำหน่าย"}
          </button>
        </form>
      </div>
    </div>
  );
}
