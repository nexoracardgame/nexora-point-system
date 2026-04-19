"use client";

import { useEffect, useRef, useState } from "react";
import { UploadCloud, User2 } from "lucide-react";

export default function ProfileSettingsPage() {
  const [ready, setReady] = useState(false); //

  const [saving, setSaving] = useState(false); //

  const [coverUrl, setCoverUrl] = useState("/seller-cover.jpg");
  const [coverPosition, setCoverPosition] = useState(50); // 🔥 เพิ่ม

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [lineLink, setLineLink] = useState("");
  const [facebookLink, setFacebookLink] = useState("");
  const [profileImage, setProfileImage] = useState("/avatar.png");

  const coverInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  const coverRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
  let mounted = true;

  async function loadProfile() {
    const res = await fetch("/api/profile/me", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !mounted) return;

    setCoverUrl(data.coverImage || "/seller-cover.jpg");
    setCoverPosition(data.coverPosition ?? 50);
    setDisplayName(data.displayName || data.name || "");
    setBio(data.bio || "");
    setLineLink(data.lineUrl || "");
    setFacebookLink(data.facebookUrl || "");
    setProfileImage(data.image || "/avatar.png");

    setReady(true); // 🔥 ย้ายมาไว้ตรงนี้
  }

  loadProfile();

  return () => {
    mounted = false;
  };
}, []);

  function uploadImage(file: File, type: "profile" | "cover") {
    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result as string;

      if (type === "profile") {
        setProfileImage(base64);
      } else {
        setCoverUrl(base64);
        setCoverPosition(50);
      }
    };

    reader.readAsDataURL(file);
  }

  // 🔥 ระบบลาก (ใช้ของเดิมที่ผ่านแล้ว)
  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging.current || !coverRef.current) return;

    const rect = coverRef.current.getBoundingClientRect();
    const percent = ((e.clientY - rect.top) / rect.height) * 100;

    const clamped = Math.max(0, Math.min(100, percent));
    setCoverPosition(clamped);
  }

  async function saveProfile() {
    try {
      setSaving(true);

      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coverUrl,
          coverPosition,
          displayName,
          bio,
          lineLink,
          facebookLink,
          profileImage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Save failed");
        return;
      }

      alert("บันทึกโปรไฟล์สำเร็จ 🎉");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1b1140_0%,#090b12_45%,#05070d_100%)] p-4 text-white sm:p-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">

        {/* LEFT PANEL */}
        <section className="rounded-[36px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl">

          {/* PROFILE IMAGE */}
          <div className="mt-6">
            <div className="text-sm font-semibold text-white/70 flex items-center gap-2">
              <User2 className="h-4 w-4" />
              Profile Image
            </div>

            <button
              onClick={() => profileInputRef.current?.click()}
              className="mt-3 relative block"
            >
              <img
                src={profileImage}
                alt="profile"
                className="h-28 w-28 rounded-full border-4 border-violet-400/20 object-cover shadow-2xl transition hover:scale-105"
              />
              <div className="absolute bottom-0 right-0 rounded-full bg-violet-500 px-3 py-1 text-[10px] font-black">
                EDIT
              </div>
            </button>

            <input
              ref={profileInputRef}
              type="file"
              accept="image/*"              
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                uploadImage(file, "profile");
              }}
            />
          </div>

          {/* COVER */}
          <div className="mt-6">
            <div className="text-sm font-semibold text-white/70 flex items-center gap-2">
              <UploadCloud className="h-4 w-4" />
              Upload Cover Banner
            </div>

            <button
              onClick={() => coverInputRef.current?.click()}
              className="mt-3 flex w-full items-center justify-between rounded-3xl border border-violet-400/20 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-pink-500/10 px-5 py-4"
            >
              <div>
                <div className="text-sm font-bold text-white">
                  🖼 Choose Cover Image
                </div>
                <div className="text-xs text-zinc-400">
                  รองรับมือถือ / แกลเลอรี่ / LINE browser
                </div>
              </div>
              <div className="text-xs text-violet-300">Browse</div>
            </button>

            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"              
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                uploadImage(file, "cover");
              }}
            />

            {/* 🔥 DRAG AREA */}
            <div
              ref={coverRef}
              onPointerDown={(e) => {
                isDragging.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerUp={() => (isDragging.current = false)}
              onPointerLeave={() => (isDragging.current = false)}
              onPointerMove={handlePointerMove}
              className="mt-4 h-40 overflow-hidden rounded-3xl border border-white/10 cursor-grab active:cursor-grabbing select-none"
            >
              <img
                src={coverUrl}
                draggable={false}
                className="h-full w-full object-cover pointer-events-none"
                style={{
                  objectPosition: `center ${coverPosition}%`,
                }}
              />
            </div>
          </div>

          {/* TEXT FIELDS */}
          <div className="mt-4">
            <label className="text-sm text-white/70">Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full p-3 bg-black/40 rounded-xl"
            />
          </div>

          <div className="mt-2">
            <label className="text-sm text-white/70">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 w-full p-3 bg-black/40 rounded-xl"
            />
          </div>

          <div className="mt-2">
            <label className="text-sm text-white/70">LINE Link</label>
            <input
              value={lineLink}
              onChange={(e) => setLineLink(e.target.value)}
              className="mt-1 w-full p-3 bg-black/40 rounded-xl"
            />
          </div>

          <div className="mt-2">
            <label className="text-sm text-white/70">Facebook Link</label>
            <input
              value={facebookLink}
              onChange={(e) => setFacebookLink(e.target.value)}
              className="mt-1 w-full p-3 bg-black/40 rounded-xl"
            />
          </div>

          {/* SAVE */}
          <button
            onClick={saveProfile}
            disabled={saving}
            className="mt-6 w-full py-4 bg-violet-500 rounded-2xl font-bold"
          >
            {saving ? "Saving..." : "💾 Save Profile"}
          </button>
        </section>

        {/* RIGHT PREVIEW */}
        <section className="overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] shadow-2xl">
          <div className="relative h-[260px] overflow-hidden">
            <img
              src={coverUrl}
              className="h-full w-full object-cover"
              style={{
                objectPosition: `center ${coverPosition}%`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090b12] via-black/30 to-transparent" />
          </div>

          <div className="p-6">
            <h1 className="text-xl font-bold">{displayName}</h1>

            <p className="mt-2 text-sm text-white/60">
              {bio || "Top-tier NEXORA trader ⚡"}
            </p>

            {/* 🔥 LINKS */}
            <div className="mt-3 flex gap-4">
              {lineLink && (
                <a
                  href={lineLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 underline"
                >
                  LINE
                </a>
              )}
              {facebookLink && (
                <a
                  href={facebookLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline"
                >
                  Facebook
                </a>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}