"use client";

export default function DeleteListingButton({
  id,
}: {
  id: string;
}) {
  return (
    <button
      onClick={async () => {
        const ok = confirm("ลบโพสต์นี้ใช่ไหม?");
        if (!ok) return;

        const res = await fetch(`/api/market/delete/${id}`, {
          method: "DELETE",
        });

        if (res.ok) {
          window.location.reload();
        } else {
          alert("ลบไม่สำเร็จ");
        }
      }}
      className="w-full rounded-2xl bg-red-500/10 px-4 py-3 text-center text-sm font-bold text-red-300 transition-all duration-300 hover:scale-[1.02] hover:bg-red-500/20"
    >
      🗑 ลบ
    </button>
  );
}