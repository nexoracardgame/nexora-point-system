"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  MessageCircle,
  MoveVertical,
  Save,
  Sparkles,
  Type,
} from "lucide-react";
import { emitProfileSync } from "@/lib/profile-sync";

const MAX_SOURCE_FILE_SIZE_BYTES = 25 * 1024 * 1024;

type ImageKind = "profile" | "cover";

type ProfileData = {
  coverImage?: string | null;
  coverUrl?: string | null;
  coverPosition?: number | null;
  displayName?: string | null;
  name?: string | null;
  bio?: string | null;
  lineUrl?: string | null;
  lineLink?: string | null;
  facebookUrl?: string | null;
  facebookLink?: string | null;
  image?: string | null;
  profileImage?: string | null;
};

export default function ProfileSettingsClient({
  initialProfile,
}: {
  initialProfile: ProfileData;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [processingImage, setProcessingImage] = useState<ImageKind | null>(
    null
  );

  const [coverUrl, setCoverUrl] = useState(
    initialProfile.coverImage || initialProfile.coverUrl || "/seller-cover.jpg"
  );
  const [coverPosition, setCoverPosition] = useState(
    initialProfile.coverPosition ?? 50
  );
  const [displayName, setDisplayName] = useState(
    initialProfile.displayName || initialProfile.name || ""
  );
  const [bio, setBio] = useState(initialProfile.bio || "");
  const [lineLink, setLineLink] = useState(
    initialProfile.lineUrl || initialProfile.lineLink || ""
  );
  const [facebookLink, setFacebookLink] = useState(
    initialProfile.facebookUrl || initialProfile.facebookLink || ""
  );
  const [profileImage, setProfileImage] = useState(
    initialProfile.image || initialProfile.profileImage || "/avatar.png"
  );

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

  function openProfilePicker() {
    profileInputRef.current?.click();
  }

  function openCoverPicker() {
    coverInputRef.current?.click();
  }

  function stopCoverDragging() {
    isDragging.current = false;
    document.body.style.userSelect = "";
  }

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
      const img = new window.Image();

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

    e.preventDefault();

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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#281255_0%,#0b0d14_42%,#05070d_100%)] p-4 text-white sm:p-6">
      <div className="mx-auto max-w-[1280px] space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] shadow-[0_30px_110px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
          <div
            ref={coverRef}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("[data-cover-action='true']")) {
                return;
              }

              e.preventDefault();
              isDragging.current = true;
              document.body.style.userSelect = "none";
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerUp={(e) => {
              stopCoverDragging();
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
            onPointerCancel={() => {
              stopCoverDragging();
            }}
            onPointerLeave={() => {
              stopCoverDragging();
            }}
            onPointerMove={handlePointerMove}
            className="group relative h-[250px] touch-none select-none overflow-hidden sm:h-[330px] xl:h-[410px]"
            style={{
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          >
            <Image
              src={coverUrl}
              alt="Cover banner"
              fill
              unoptimized
              sizes="(max-width: 1279px) 100vw, 1200px"
              className="object-cover transition duration-500 group-hover:scale-[1.015]"
              draggable={false}
              style={{
                objectPosition: `center ${coverPosition}%`,
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,217,102,0.22),transparent_26%),linear-gradient(180deg,rgba(8,8,12,0.04)_0%,rgba(8,8,12,0.26)_42%,rgba(10,10,18,0.92)_100%)]" />

            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/30 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-white/82 shadow-[0_10px_24px_rgba(0,0,0,0.22)] sm:left-6 sm:top-6">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Profile Studio
            </div>

            <button
              type="button"
              data-cover-action="true"
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                openCoverPicker();
              }}
              className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/34 px-4 py-2 text-sm font-bold text-white/90 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition hover:bg-black/48 sm:right-6 sm:top-6"
            >
              <ImagePlus className="h-4 w-4" />
              เปลี่ยนปก
            </button>

            <div
              data-cover-action="true"
              className="absolute right-4 top-16 rounded-full border border-white/12 bg-black/28 px-3 py-1.5 text-[11px] font-bold text-white/72 shadow-[0_10px_24px_rgba(0,0,0,0.18)] sm:right-6 sm:top-20"
            >
              ลากขึ้นลงเพื่อจัดตำแหน่ง
            </div>

            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 xl:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <button
                  type="button"
                  data-cover-action="true"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openProfilePicker();
                  }}
                  className="group/avatar relative h-28 w-28 cursor-pointer overflow-hidden rounded-full border-[5px] border-white/16 shadow-[0_22px_54px_rgba(0,0,0,0.44)] transition hover:scale-[1.02] sm:h-32 sm:w-32"
                >
                  <div className="absolute inset-[-6px] rounded-full border border-dashed border-violet-300/45 transition group-hover/avatar:border-violet-200/80" />
                  <div className="absolute inset-[-12px] rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.18)_0%,transparent_68%)]" />
                  <Image
                    src={profileImage}
                    alt="Profile image"
                    fill
                    unoptimized
                    sizes="128px"
                    className="object-cover"
                    draggable={false}
                  />
                  <div className="absolute inset-0 rounded-full ring-1 ring-white/10" />
                  <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/72 via-black/8 to-transparent pb-5">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/36 px-3 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-white/92">
                      <Camera className="h-3.5 w-3.5" />
                      แตะเปลี่ยนรูป
                    </div>
                  </div>
                </button>

                <div className="min-w-0 flex-1 sm:px-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/45">
                    ตั้งค่าโปรไฟล์
                  </div>
                  <h1 className="mt-2 truncate text-3xl font-black tracking-tight text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)] sm:text-4xl xl:text-5xl">
                    {displayName || "NEXORA USER"}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-white/68 sm:text-base">
                    {bio ||
                      "ตั้งชื่อ Bio และลิงก์ของคุณให้พร้อม แล้วดูพรีวิวเปลี่ยนแบบสดๆ ได้ทันที"}
                  </p>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/26 px-4 py-3 shadow-[0_16px_34px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:min-w-[200px]">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/44">
                    <MoveVertical className="h-3.5 w-3.5 text-violet-200" />
                    Cover Focus
                  </div>
                  <div className="mt-2 text-2xl font-black text-white">
                    {Math.round(coverPosition)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,10,16,0.92)_0%,rgba(10,10,16,0.8)_100%)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/18 bg-violet-400/10 text-violet-200 shadow-[0_14px_28px_rgba(124,58,237,0.16)]">
                <Type className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/38">
                  Edit Panel
                </div>
                <div className="mt-1 text-xl font-black text-white">
                  รายละเอียดโปรไฟล์
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="text-sm font-semibold text-white/74">
                  เปลี่ยนชื่อ
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="ตั้งชื่อที่อยากให้คนอื่นเห็น"
                  className="mt-2 h-14 w-full rounded-[22px] border border-white/10 bg-black/38 px-4 text-white outline-none transition focus:border-violet-400/35 focus:bg-black/52"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-white/74">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={5}
                  placeholder="แนะนำตัว สไตล์การเทรด หรือสิ่งที่อยากให้คนอื่นเห็น"
                  className="mt-2 w-full rounded-[22px] border border-white/10 bg-black/38 px-4 py-4 text-white outline-none transition focus:border-violet-400/35 focus:bg-black/52"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-white/74">
                  ลิงก์ LINE
                </label>
                <input
                  value={lineLink}
                  onChange={(e) => setLineLink(e.target.value)}
                  placeholder="https://line.me/..."
                  className="mt-2 h-14 w-full rounded-[22px] border border-white/10 bg-black/38 px-4 text-white outline-none transition focus:border-violet-400/35 focus:bg-black/52"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-white/74">
                  ลิงก์ Facebook
                </label>
                <input
                  value={facebookLink}
                  onChange={(e) => setFacebookLink(e.target.value)}
                  placeholder="https://facebook.com/..."
                  className="mt-2 h-14 w-full rounded-[22px] border border-white/10 bg-black/38 px-4 text-white outline-none transition focus:border-violet-400/35 focus:bg-black/52"
                />
              </div>
            </div>

            {(processingImage === "profile" || processingImage === "cover") && (
              <div className="mt-5 rounded-[22px] border border-violet-400/15 bg-violet-400/10 px-4 py-3 text-sm text-violet-100/92">
                {processingImage === "profile"
                  ? "กำลังประมวลผลรูปโปรไฟล์..."
                  : "กำลังประมวลผลรูปปก..."}
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={saveProfile}
                disabled={saving || processingImage !== null}
                className="inline-flex min-h-[60px] w-full items-center justify-center gap-3 rounded-[24px] bg-[linear-gradient(90deg,#7c3aed_0%,#8b5cf6_38%,#d946ef_100%)] px-6 text-sm font-black tracking-[0.12em] text-white shadow-[0_22px_54px_rgba(124,58,237,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving
                  ? "กำลังบันทึก..."
                  : processingImage
                    ? "กำลังประมวลผลรูป..."
                    : "บันทึกโปรไฟล์"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.02)_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
              <div className="relative h-32">
                <Image
                  src={coverUrl}
                  alt="Mini cover"
                  fill
                  unoptimized
                  sizes="340px"
                  className="object-cover"
                  draggable={false}
                  style={{
                    objectPosition: `center ${coverPosition}%`,
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/8 via-transparent to-[#140f24]" />
              </div>

              <div className="relative px-5 pb-5 pt-12">
                <div className="absolute left-5 top-0 h-20 w-20 -translate-y-1/2 overflow-hidden rounded-full border-[4px] border-white/14 shadow-[0_14px_34px_rgba(0,0,0,0.34)]">
                  <Image
                    src={profileImage}
                    alt="Mini profile"
                    fill
                    unoptimized
                    sizes="80px"
                    className="object-cover"
                    draggable={false}
                  />
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/36">
                  Mini Preview
                </div>
                <div className="mt-2 truncate text-2xl font-black text-white">
                  {displayName || "NEXORA USER"}
                </div>
                <div className="mt-2 line-clamp-3 text-sm leading-6 text-white/62">
                  {bio ||
                    "พรีวิวนี้จะเปลี่ยนตามข้อมูลที่คุณกำลังแก้ด้านซ้ายแบบสดๆ"}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <div className="inline-flex min-h-[46px] items-center rounded-[17px] border border-emerald-400/24 bg-emerald-400/10 px-4 text-sm font-black text-emerald-200">
                    LINE
                  </div>
                  <div className="inline-flex min-h-[46px] items-center rounded-[17px] border border-sky-400/24 bg-sky-400/10 px-4 text-sm font-black text-sky-200">
                    Facebook
                  </div>
                  <Link
                    href="/dm"
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-[17px] border border-white/16 bg-[linear-gradient(180deg,rgba(245,243,255,0.88)_0%,rgba(226,232,240,0.74)_100%)] px-4 text-sm font-black text-black transition hover:brightness-110"
                  >
                    <MessageCircle className="h-4 w-4" />
                    แชท
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.02)_100%)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.16)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/38">
                Quick Guide
              </div>
              <div className="mt-3 space-y-3 text-sm leading-6 text-white/62">
                <p>แตะรูปวงกลมหรือปุ่มบนหน้าปกเพื่อเปลี่ยนภาพได้ทันที</p>
                <p>บนมือถือสามารถลากหน้าปกขึ้นลงได้ลื่นขึ้นโดยไม่ชนกับการสกอลล์หน้า</p>
                <p>ทุกค่าที่เห็นในกล่องนี้คือพรีวิวก่อนบันทึกจริง</p>
              </div>
            </div>
          </div>
        </section>

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
      </div>
    </div>
  );
}
