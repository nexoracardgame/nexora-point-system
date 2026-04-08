"use client";

import { useState } from "react";

export default function SerialVerifyBox({
  listingSerial,
}: {
  listingSerial: string;
}) {
  const [serial, setSerial] = useState("");
  const [message, setMessage] = useState("");

  const handleVerify = () => {
    const value = serial.trim();

    if (!/^\d{5,6}$/.test(value)) {
      setMessage("❌ ต้องเป็นเลข 5-6 หลัก");
      return;
    }

    if (value === listingSerial) {
      setMessage("✅ Serial ตรงกับโพสต์ขาย รับของได้");
    } else {
      setMessage("❌ Serial ไม่ตรงกับโพสต์นี้");
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-400/[0.04] p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">
        Serial Verify Match
      </div>

      <div className="mt-2 text-sm text-zinc-400">
        Serial อ้างอิงจากผู้ขาย:{" "}
        <span className="font-bold text-cyan-200">
          {listingSerial}
        </span>
      </div>

      <input
        value={serial}
        onChange={(e) => setSerial(e.target.value)}
        placeholder="กรอกเลขหลังการ์ด"
        className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
      />

      <button
        onClick={handleVerify}
        className="mt-3 rounded-xl bg-cyan-400 px-4 py-2 font-bold text-black"
      >
        Verify Match
      </button>

      {message && (
        <div className="mt-3 rounded-xl bg-white/5 px-4 py-3 text-sm">
          {message}
        </div>
      )}
    </div>
  );
}