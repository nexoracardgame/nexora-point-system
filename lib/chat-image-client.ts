"use client";

const MAX_SOURCE_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_CHAT_EDGE = 1800;

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

export async function prepareChatImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("กรุณาเลือกรูปภาพ");
  }

  if (file.size > MAX_SOURCE_FILE_SIZE_BYTES) {
    throw new Error("รูปใหญ่เกินไป กรุณาใช้ไฟล์ไม่เกิน 25MB");
  }

  const sourceUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(sourceUrl);
  const canvas = document.createElement("canvas");

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (!width || !height) {
    throw new Error("ขนาดรูปไม่ถูกต้อง");
  }

  if (width > height) {
    if (width > MAX_CHAT_EDGE) {
      height *= MAX_CHAT_EDGE / width;
      width = MAX_CHAT_EDGE;
    }
  } else if (height > MAX_CHAT_EDGE) {
    width *= MAX_CHAT_EDGE / height;
    height = MAX_CHAT_EDGE;
  }

  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("ไม่สามารถประมวลผลรูปได้");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (value) {
          resolve(value);
          return;
        }

        reject(new Error("ไม่สามารถแปลงรูปได้"));
      },
      "image/jpeg",
      0.88
    );
  });

  return new File([blob], `chat-${Date.now()}.jpg`, {
    type: "image/jpeg",
  });
}

export async function uploadChatImageFile(file: File) {
  const optimizedFile = await prepareChatImageFile(file);
  const formData = new FormData();
  formData.append("file", optimizedFile);

  const res = await fetch("/api/upload/chat", {
    method: "POST",
    body: formData,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.url) {
    throw new Error(data?.error || "อัปโหลดรูปไม่สำเร็จ");
  }

  return String(data.url);
}
