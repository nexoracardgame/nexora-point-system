"use client";

import { useEffect, useRef, useState } from "react";

export default function ProfileSettingsPage() {
  const [saving, setSaving] = useState(false);

  const [coverUrl, setCoverUrl] = useState("/seller-cover.jpg");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [lineLink, setLineLink] = useState("");
  const [facebookLink, setFacebookLink] = useState("");
  const [profileImage, setProfileImage] = useState("/avatar.png");

  const coverInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const res = await fetch("/api/profile/me", {
          cache: "force-cache",
        });

        const data = await res.json();
        if (!res.ok || !mounted) return;

        setCoverUrl(data.coverImage || "/seller-cover.jpg");
        setDisplayName(data.displayName || data.name || "");
        setBio(data.bio || "");
        setLineLink(data.lineUrl || "");
        setFacebookLink(data.facebookUrl || "");
        setProfileImage(data.image || "/avatar.png");
      } catch {
      } 
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
      }
    };

    reader.readAsDataURL(file);
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1b1140_0%,#090b12_45%,#05070d_100%)] p-4 text-white sm:p-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        {/* LEFT */}
        <section className="rounded-[36px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
          <div className="text-xs uppercase tracking-[0.35em] text-violet-300">
            PROFILE SETTINGS
          </div>

          <h1 className="mt-4 text-4xl font-black">
            Customize Your Seller Identity
          </h1>

          {/* PROFILE IMAGE */}
          <div className="mt-6">
            <div className="text-sm font-semibold text-white/70">
              Profile Image
            </div>

            <button
              type="button"
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
            <label className="text-sm font-semibold text-white/70">
              Upload Cover Banner
            </label>

            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="mt-3 flex w-full items-center justify-between rounded-3xl border border-violet-400/20 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-pink-500/10 px-5 py-4 transition hover:border-violet-300/40"
            >
              <div className="text-left">
                <div className="text-sm font-bold text-white">
                  🖼 Choose Cover Image
                </div>
                <div className="mt-1 text-xs text-zinc-400">
                  รองรับมือถือ / แกลเลอรี่ / LINE browser
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-4 py-2 text-xs font-bold text-violet-300">
                Browse
              </div>
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

            <div className="mt-4 overflow-hidden rounded-3xl border border-white/10">
              <img
                src={coverUrl}
                alt="cover preview"
                className="h-40 w-full object-cover"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-white/70">
              Display Name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
            />
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-white/70">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
            />
          </div>

          <div className="mt-4 space-y-4">
            <input
              value={lineLink}
              onChange={(e) => setLineLink(e.target.value)}
              placeholder="LINE OA URL"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
            />
            <input
              value={facebookLink}
              onChange={(e) => setFacebookLink(e.target.value)}
              placeholder="Facebook URL"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
            />
          </div>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 py-4 text-lg font-black disabled:opacity-50"
          >
            {saving ? "Saving..." : "💾 Save Profile"}
          </button>
        </section>

        {/* RIGHT PREVIEW */}
        <section className="overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] shadow-2xl">
          <div className="relative h-[260px] overflow-hidden">
            <img
              src={coverUrl}
              alt="cover"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090b12] via-black/30 to-transparent" />
          </div>

          <div className="relative px-8 pb-8">
            <div className="-mt-16 flex items-end gap-5">
              <img
                src={profileImage}
                alt="profile"
                className="h-28 w-28 rounded-full border-4 border-white object-cover shadow-2xl"
              />

              <div className="pb-2">
                <h1 className="text-4xl font-black">
                  {displayName || "Seller Name"}
                </h1>
                <p className="mt-1 text-sm text-zinc-400">
                  {bio || "Top-tier NEXORA trader ⚡"}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}