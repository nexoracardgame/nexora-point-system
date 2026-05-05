"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { nexoraAlert } from "@/lib/nexora-dialog";

export default function VerifySaleForm({
  dealId,
}: {
  dealId: string;
}) {
  const router = useRouter();
  const [serialInput, setSerialInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (loading) return;
    if (!serialInput.trim()) {
      alert("เธเธฃเธญเธ serial เธเนเธญเธ");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/market/deal-verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealId,
          serialInput,
        }),
      });

      const data = await res.json();

      if (data.success) {
        await nexoraAlert({
          title: "ปิดการขายสำเร็จ",
          message: "ระบบยืนยัน serial และปิดการขายเรียบร้อยแล้ว",
          tone: "success",
        });

        // ๐”ฅ เน€เธเธฅเธตเนเธขเธเธ•เธฃเธเธเธตเน
        window.location.href = "/market/seller-center";
      } else {
        alert(data.error || "Verify เนเธกเนเธชเธณเน€เธฃเนเธ");
      }
    } catch (error) {
      console.error(error);
      alert("เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#22114a_0%,#090b12_40%,#05070d_100%)] px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">
          NEXORA FINAL VERIFY
        </div>

        <h1 className="mt-2 text-3xl font-black">
          ๐” Verify Serial & Close Sale
        </h1>

        <p className="mt-3 text-sm text-zinc-400">
          เธซเธฅเธฑเธเธ•เธฃเธงเธเธชเธ เธฒเธเธเธฒเธฃเนเธ”เธเธฃเธดเธเนเธฅเนเธง เนเธซเนเธเธฃเธญเธ serial เธซเธฅเธฑเธเธเธฒเธฃเนเธ”เน€เธเธทเนเธญเธเธดเธ”เธเธฒเธฃเธเธฒเธขเธเธฃเธดเธเธ—เธฑเนเธเธฃเธฐเธเธ
        </p>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-bold text-white/80">
            Serial เธซเธฅเธฑเธเธเธฒเธฃเนเธ”
          </label>

          <input
            value={serialInput}
            onChange={(e) => setSerialInput(e.target.value)}
            placeholder="เธเธฃเธญเธ serial เธซเธฅเธฑเธเธเธฒเธฃเนเธ”"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          />
        </div>

        <button
          onClick={handleVerify}
          disabled={loading}
          className={`mt-6 w-full rounded-2xl px-5 py-3 font-bold text-white transition ${
            loading
              ? "cursor-not-allowed bg-zinc-600"
              : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-[1.02]"
          }`}
        >
          {loading ? "Verifying..." : "โ… Confirm & Close Sale"}
        </button>
      </div>
    </div>
  );
}
