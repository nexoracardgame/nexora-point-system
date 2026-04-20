import { mkdir, writeFile } from "fs/promises";
import crypto from "crypto";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const kind = String(formData.get("kind") || "cover").trim();

    if (!file) {
      return Response.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const extFromType =
      file.type === "image/png"
        ? ".png"
        : file.type === "image/webp"
          ? ".webp"
          : ".jpg";
    const safeKind = kind === "profile" ? "profile" : "cover";
    const fileName = `profile-assets/${safeKind}-${Date.now()}-${crypto.randomUUID()}${extFromType}`;

    const { error: storageError } = await supabase.storage
      .from("chat-images")
      .upload(fileName, buffer, {
        upsert: false,
        contentType: file.type || "image/jpeg",
        cacheControl: "31536000",
      });

    if (!storageError) {
      const { data: url } = supabase.storage
        .from("chat-images")
        .getPublicUrl(fileName);

      return Response.json({
        url: url.publicUrl,
      });
    }

    if (process.env.NODE_ENV === "production") {
      console.error("PROFILE STORAGE UPLOAD ERROR:", storageError);
      return Response.json(
        { error: "Upload failed" },
        { status: 500 }
      );
    }

    const localFileName = `${safeKind}-${Date.now()}${extFromType}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", safeKind);
    const filePath = path.join(uploadDir, localFileName);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(filePath, buffer);

    return Response.json({
      url: `/uploads/${safeKind}/${localFileName}`,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
