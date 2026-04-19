"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Room = {
  roomId: string;
  lastMessage: string;
  createdAt: string;
  otherName: string;
  otherImage: string;
  unread: number;
};

export default function DMListPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [me, setMe] = useState<any>(null);

  const hasInit = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;

    const init = async () => {
      const res = await fetch("/api/auth/session");
      const session = await res.json();
      const meUser = session.user;

      setMe(meUser);

      await loadRooms(meUser);

      // 🔥 kill channel เก่า
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // 🔥 realtime
      channelRef.current = supabase
  .channel("dm-list")

  // 🔥 ใส่ on ก่อน
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "dmMessage" },
    () => {
      loadRooms(meUser);
    }
  )

  // 🔥 แล้วค่อย subscribe
  .subscribe();
    };

    init();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const loadRooms = async (meUser: any) => {
    // 🔥 ดึงห้อง
    const { data: roomsData, error: roomErr } = await supabase
      .from("dm_room")
      .select("*")
      .order("updatedat", { ascending: false });

    if (roomErr) {
      console.error("ROOM ERROR:", roomErr);
      return;
    }

    // 🔥 ดึงข้อความ
    const { data: messages, error: msgErr } = await supabase
      .from("dmMessage")
      .select("*");

    if (msgErr) {
      console.error("MSG ERROR:", msgErr);
      return;
    }

    const result: Room[] = [];

    // ✅ เอาเฉพาะห้องของเรา
    const myRooms = (roomsData || []).filter(
      (r: any) => r.usera === meUser.id || r.userb === meUser.id
    );

    myRooms.forEach((r: any) => {
      const roomMsgs = (messages || []).filter(
        (m: any) => m.roomId === r.roomid
      );

      if (roomMsgs.length === 0) return; // ❗ ไม่มีข้อความ ไม่ต้องโชว์

      // 🔥 ข้อความล่าสุด
      const lastMsg = [...roomMsgs].sort((a: any, b: any) =>
        (b.createdAt || "").localeCompare(a.createdAt || "")
      )[0];

      // 🔥 หา "อีกฝั่ง" จาก message จริง (สำคัญสุด)
      const isMeLast = lastMsg?.senderId === meUser.id;

// 🔥 ถ้าข้อความล่าสุดเราพิม → เอาอีกฝั่ง
// 🔥 ถ้าอีกฝั่งพิม → ใช้เลย

      const otherName = isMeLast
        ? roomMsgs.find((m: any) => m.senderId !== meUser.id)?.senderName || "User"
        : lastMsg?.senderName || "User";

      const otherImage = isMeLast
        ? roomMsgs.find((m: any) => m.senderId !== meUser.id)?.senderImage || "/avatar.png"
        : lastMsg?.senderImage || "/avatar.png";

      // 🔴 unread
      const unread = roomMsgs.filter(
        (m: any) =>
          m.senderId !== meUser.id && !m.seenAt
      ).length;

      result.push({
        roomId: r.roomid,
        otherName,
        otherImage,
        lastMessage: lastMsg?.content || "📷 รูปภาพ",
        createdAt: lastMsg?.createdAt || r.updatedat,
        unread,
      });
    });

    // 🔥 เรียงแบบ LINE
    result.sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    );

    setRooms(result);
  };

  return (
    <div className="max-w-[720px] mx-auto px-3 py-4 text-white">
      <h1 className="text-xl font-bold mb-4">แชท</h1>

      <div className="space-y-2">
        {rooms.map((r) => (
          <Link
            key={r.roomId}
            href={`/dm/${r.roomId}`}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition"
          >
            <div className="relative">
              <img
                src={r.otherImage}
                className="w-12 h-12 rounded-full object-cover"
              />

              {r.unread > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {r.unread}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">
                {r.otherName}
              </div>

              <div className="text-sm text-white/50 truncate">
                {r.lastMessage}
              </div>
            </div>
          </Link>
        ))}

        {rooms.length === 0 && (
          <div className="text-center text-white/40 mt-10">
            ยังไม่มีแชท
          </div>
        )}
      </div>
    </div>
  );
}