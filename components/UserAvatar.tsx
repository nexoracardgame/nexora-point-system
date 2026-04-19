"use client";

import { useEffect, useState } from "react";
import { listenProfileSync } from "@/lib/profile-sync";

export default function UserAvatar({
  className = "",
}: {
  className?: string;
}) {
  const [image, setImage] = useState("/avatar.png");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile/me", {
          cache: "no-store",
        });
        const data = await res.json();

        if (res.ok && data.image) {
          setImage(data.image);
        }
      } catch {}
    }

    load();

    return listenProfileSync((detail) => {
      if (detail.image) {
        setImage(detail.image);
      }
    });
  }, []);

  return (
    <img
      src={image}
      alt="profile"
      className={className}
    />
  );
}
