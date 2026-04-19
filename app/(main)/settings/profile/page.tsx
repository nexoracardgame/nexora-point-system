"use client";

import { useEffect, useRef, useState } from "react";
import { UploadCloud, User2 } from "lucide-react";

export default function ProfileSettingsPage() {
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const [coverUrl, setCoverUrl] = useState("/seller-cover.jpg");
  const [coverPosition, setCoverPosition] = useState(50);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [lineLink, setLineLink] = useState("");
  const [facebookLink, setFacebookLink] = useState("");
  const [profileImage, setProfileImage] = useState("/avatar.png");

  const coverInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  const coverRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  async function loadProfile() {
    const res = await fetch("/api/profile/me", { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) return false;

    setCoverUrl(data.coverImage || data.coverUrl || "/seller-cover.jpg");
    setCoverPosition(data.coverPosition ?? 50);
    setDisplayName(data.displayName || data.name || "");
    setBio(data.bio || "");
    setLineLink(data.lineUrl || data.lineLink || "");
    setFacebookLink(data.facebookUrl || data.facebookLink || "");
    setProfileImage(data.image || data.profileImage || "/avatar.png");

    return true;
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      const ok = await loadProfile();
      if (mounted && ok) {
        setReady(true);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  function uploadImage(file: File, type: "profile" | "cover") {
  const img = new Image();
  const reader = new FileReader();

  reader.onload = () => {
    img.src = reader.result as string;
  };

  img.onload = () => {
    const canvas = document.createElement("canvas");
    const maxSize = 800; // 🔥 จำกัดขนาด

    let width = img.width;
    let height = img.height;

    if (width > height) {
      if (width > maxSize) {
        height *= maxSize / width;
        width = maxSize;
      }
    } else {
      if (height > maxSize) {
        width *= maxSize / height;
        height = maxSize;
      }
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, 0, 0, width, height);

    // 🔥 บีบคุณภาพ
    const compressed = canvas.toDataURL("image/jpeg", 0.7);

    if (type === "profile") {
      setProfileImage(compressed);
    } else {
      setCoverUrl(compressed);
      setCoverPosition(50);
    }
  };

  reader.readAsDataURL(file);
}

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

      const payload = {
        // รูปแบบเดิม
        coverUrl,
        coverPosition,
        displayName,
        bio,
        lineLink,
        facebookLink,
        profileImage,

        // รูปแบบสำรองให้ backend ที่ใช้ชื่ออีกแบบ
        coverImage: coverUrl,
        image: profileImage,
        lineUrl: lineLink,
        facebookUrl: facebookLink,
      };

      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "Save failed");
        return;
      }

      // โหลดค่าจริงกลับมาหลังเซฟ เพื่อให้มือถือ/คอมตรงกันทันที
      await loadProfile();

      alert("บันทึกโปรไฟล์สำเร็จ 🎉");
    } catch (error) {
      console.error("SAVE PROFILE ERROR:", error);
      alert("Save failed");
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
            <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
              <User2 className="h-4 w-4" />
              Profile Image
            </div>

            <button
              type="button"
              onClick={() => profileInputRef.current?.click()}
              className="relative mt-3 block"
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
                e.currentTarget.value = "";
              }}
            />
          </div>

          {/* COVER */}
          <div className="mt-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
              <UploadCloud className="h-4 w-4" />
              Upload Cover Banner
            </div>

            <button
              type="button"
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
                e.currentTarget.value = "";
              }}
            />

            {/* DRAG AREA */}
            <div
              ref={coverRef}
              onPointerDown={(e) => {
                isDragging.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerUp={() => {
                isDragging.current = false;
              }}
              onPointerLeave={() => {
                isDragging.current = false;
              }}
              onPointerMove={handlePointerMove}
              className="mt-4 h-40 cursor-grab select-none overflow-hidden rounded-3xl border border-white/10 active:cursor-grabbing"
            >
              <img
                src={coverUrl}
                draggable={false}
                className="pointer-events-none h-full w-full object-cover"
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
              className="mt-1 w-full rounded-xl bg-black/40 p-3"
            />
          </div>

          <div className="mt-2">
            <label className="text-sm text-white/70">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 w-full rounded-xl bg-black/40 p-3"
            />
          </div>

          <div className="mt-2">
            <label className="text-sm text-white/70">LINE Link</label>
            <input
              value={lineLink}
              onChange={(e) => setLineLink(e.target.value)}
              className="mt-1 w-full rounded-xl bg-black/40 p-3"
            />
          </div>

          <div className="mt-2">
            <label className="text-sm text-white/70">Facebook Link</label>
            <input
              value={facebookLink}
              onChange={(e) => setFacebookLink(e.target.value)}
              className="mt-1 w-full rounded-xl bg-black/40 p-3"
            />
          </div>

          {/* SAVE */}
          <button
            onClick={saveProfile}
            disabled={saving}
            className="mt-6 w-full rounded-2xl bg-violet-500 py-4 font-bold"
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