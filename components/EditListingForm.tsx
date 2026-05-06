"use client";

import { useState } from "react";
import { nexoraAlert } from "@/lib/nexora-dialog";

export default function EditListingForm({
  id,
  price,
}: {
  id: string;
  price: number;
}) {
  const [newPrice, setNewPrice] = useState(price);

  return (
    <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-white">
      <h1 className="text-2xl font-bold">Edit Listing</h1>

      <input
        type="number"
        value={newPrice}
        onChange={(e) => setNewPrice(Number(e.target.value))}
        className="mt-4 w-full rounded-xl bg-black/30 p-3"
      />

      <button
        onClick={async () => {
          const res = await fetch(`/api/market/edit/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              price: newPrice,
            }),
          });

          if (res.ok) {
            await nexoraAlert({
              title: "แก้ไขสำเร็จ",
              message: "ระบบบันทึกราคาการ์ดเรียบร้อยแล้ว",
              tone: "success",
            });
            window.location.href = "/market/seller-center";
          } else {
            alert("แก้ไขไม่สำเร็จ");
          }
        }}
        className="mt-4 rounded-xl bg-blue-500 px-4 py-2"
      >
        Save
      </button>
    </div>
  );
}
