"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { UploadCloud, User2 } from "lucide-react";
import { emitProfileSync } from "@/lib/profile-sync";

const MAX_SOURCE_FILE_SIZE_BYTES = 25 * 1024 * 1024;

type ImageKind = "profile" | "cover";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { update } = useSession();
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingImage, setProcessingImage] = useState<ImageKind | null>(null);

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

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }

        reject(new Error("Unable to read image"));
      };

      reader.onerror = () => reject(new Error("Unable to read image"));
      reader.readAsDataURL(file);
    });
  }

  function loadImageElement(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to load image"));
      img.src = src;
    });
  }

  async function processImageFile(file: File, type: ImageKind) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please choose an image file");
    }

    if (file.size > MAX_SOURCE_FILE_SIZE_BYTES) {
      throw new Error("Image is too large. Please use a file under 25MB");
    }

    const sourceUrl = await readFileAsDataUrl(file);
    const img = await loadImageElement(sourceUrl);
    const canvas = document.createElement("canvas");
    const isCover = type === "cover";
    const maxSize = isCover ? 2200 : 1080;
    const exportType =
      isCover && file.type === "image/png" ? "image/png" : "image/jpeg";
    const exportQuality = isCover ? 0.94 : 0.88;

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (!width || !height) {
      throw new Error("Invalid image dimensions");
    }

    if (width > height) {
      if (width > maxSize) {
        height *= maxSize / width;
        width = maxSize;
      }
    } else if (height > maxSize) {
      width *= maxSize / height;
      height = maxSize;
    }

    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to process image");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return exportType === "image/png"
      ? canvas.toDataURL(exportType)
      : canvas.toDataURL(exportType, exportQuality);
  }

  async function uploadImage(file: File, type: ImageKind) {
    try {
      setProcessingImage(type);
      const compressed = await processImageFile(file, type);

      if (type === "profile") {
        setProfileImage(compressed);
      } else {
        setCoverUrl(compressed);
        setCoverPosition(50);
      }
    } catch (error) {
      console.error("PROCESS IMAGE ERROR:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Unable to process this image"
      );
    } finally {
      setProcessingImage((current) => (current === type ? null : current));
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging.current || !coverRef.current) return;

    const rect = coverRef.current.getBoundingClientRect();
    const percent = ((e.clientY - rect.top) / rect.height) * 100;
    const clamped = Math.max(0, Math.min(100, percent));

    setCoverPosition(clamped);
  }

  async function saveProfile() {
    if (processingImage) {
      alert("Please wait for the image to finish processing first");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        coverUrl,
        coverPosition,
        displayName,
        bio,
        lineLink,
        facebookLink,
        profileImage,
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

      const syncedName =
        data?.user?.displayName || data?.user?.name || displayName || "";
      const syncedImage = data?.user?.image || profileImage || "/avatar.png";

      await update({
        name: syncedName,
        image: syncedImage,
      });

      emitProfileSync({
        name: syncedName,
        image: syncedImage,
      });

      router.refresh();
      await loadProfile();

      alert("Saved successfully");
    } catch (error) {
      console.error("SAVE PROFILE ERROR:", error);
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1b1140_0%,#090b12_45%,#05070d_100%)] p-4 text-white sm:p-6">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <div className="rounded-[36px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
            <div className="h-8 w-40 animate-pulse rounded-xl bg-white/10" />
            <div className="mt-6 h-28 w-28 animate-pulse rounded-full bg-white/10" />
            <div className="mt-6 h-16 animate-pulse rounded-3xl bg-white/10" />
          </div>
          <div className="overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] shadow-2xl">
            <div className="h-[260px] animate-pulse bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1b1140_0%,#090b12_45%,#05070d_100%)] p-4 text-white sm:p-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-[36px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
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

                void uploadImage(file, "profile");
                e.currentTarget.value = "";
              }}
            />
            {processingImage === "profile" && (
              <div className="mt-3 text-xs text-violet-200/80">
                Processing profile image...
              </div>
            )}
          </div>

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
                  Choose Cover Image
                </div>
                <div className="text-xs text-zinc-400">
                  Works on mobile, gallery, and LINE browser. Up to 25MB.
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

                void uploadImage(file, "cover");
                e.currentTarget.value = "";
              }}
            />

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
                alt="Cover preview"
                draggable={false}
                className="pointer-events-none h-full w-full object-cover"
                style={{
                  objectPosition: `center ${coverPosition}%`,
                }}
              />
            </div>
            {processingImage === "cover" && (
              <div className="mt-3 text-xs text-violet-200/80">
                Processing cover image...
              </div>
            )}
          </div>

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

          <button
            onClick={saveProfile}
            disabled={saving || processingImage !== null}
            className="mt-6 w-full rounded-2xl bg-violet-500 py-4 font-bold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : processingImage
                ? "Processing Image..."
                : "Save Profile"}
          </button>
        </section>

        <section className="overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] shadow-2xl">
          <div className="relative h-[260px] overflow-hidden">
            <img
              src={coverUrl}
              alt="Cover banner"
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
              {bio || "Top-tier NEXORA trader"}
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
