"use client";

import { useEffect, useState } from "react";

export default function UserAvatar({
  className = "",
}: {
  className?: string;
}) {
  const [image, setImage] = useState("/avatar.png");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile/me");
        const data = await res.json();

        if (res.ok && data.image) {
          setImage(data.image);
        }
      } catch {}
    }

    load();
  }, []);

  return (
    <img
      src={image}
      alt="profile"
      className={className}
    />
  );
}