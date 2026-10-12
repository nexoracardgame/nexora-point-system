"use client";

import { useEffect, useRef } from "react";

const textures = ["spark_01", "flare_01", "smoke_01", "slash_01", "magic_01"];

export default function BattleParticles({ color, side, skill, field, blocked, reduced }: {
  color: string; side: "player" | "opponent"; skill: boolean; field: boolean; blocked: boolean; reduced: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || reduced) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let stopped = false;
    const startedAt = performance.now();
    const sprites = textures.map((name) => {
      const img = new Image();
      img.src = `/battle-fx/${name}.png`;
      return img;
    });
    const tinted: HTMLCanvasElement[] = [];
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.scale(dpr, dpr);
    const mobile = width < 600;
    const targetX = skill ? width / 2 : side === "player" ? width * (mobile ? .82 : .77) : width * (mobile ? .18 : .23);
    const targetY = height * .39;
    const particles = Array.from({ length: mobile ? 50 : 90 }, (_, i) => ({
      angle: i * 2.39996,
      speed: 90 + (i * 37 % 230),
      size: 10 + (i * 13 % 32),
      life: .32 + (i * 17 % 60) / 100,
      spin: (i % 2 ? 1 : -1) * (i % 5 + 1),
    }));
    const sprite = (id: number, x: number, y: number, size: number, rotation = 0, opacity = 1) => {
      const img = sprites[id];
      if (!img.complete || !img.naturalWidth) return;
      if (!tinted[id]) {
        const buffer = document.createElement("canvas");
        buffer.width = buffer.height = 256;
        const paint = buffer.getContext("2d")!;
        paint.drawImage(img, 0, 0, 256, 256);
        paint.globalCompositeOperation = "source-in";
        paint.fillStyle = blocked ? "#b9e7ff" : color;
        paint.fillRect(0, 0, 256, 256);
        tinted[id] = buffer;
      }
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.drawImage(tinted[id], -size / 2, -size / 2, size, size);
      ctx.restore();
    };
    const draw = (now: number) => {
      if (stopped) return;
      const elapsed = (now - startedAt) / 1000;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      // Energy gathers first; particles release on the same frame as card contact.
      if (elapsed < .52) {
        const charge = Math.min(elapsed / .52, 1);
        const sourceX = side === "player" ? width * .23 : width * .77;
        const x = skill ? width / 2 : sourceX + (targetX - sourceX) * Math.max(0, (charge - .4) / .6);
        sprite(skill ? 4 : 1, x, targetY, 55 + charge * 160, elapsed * 2, charge * .7);
        for (let i = 0; i < 10; i++) sprite(0, x + Math.cos(i + elapsed * 8) * 55 * (1 - charge), targetY + Math.sin(i + elapsed * 8) * 55 * (1 - charge), 16, i, charge);
      }
      const hit = elapsed - .52;
      if (hit >= 0) {
        const flash = Math.max(0, 1 - hit * 8);
        sprite(1, targetX, targetY, (mobile ? 240 : 420) + hit * 200, 0, flash);
        sprite(blocked ? 4 : 3, targetX, targetY, mobile ? 190 : 310, side === "player" ? -.7 : .7, Math.max(0, 1 - hit * 3));
        for (const p of particles) {
          if (hit > p.life) continue;
          const distance = p.speed * hit;
          sprite(0, targetX + Math.cos(p.angle) * distance, targetY + Math.sin(p.angle) * distance + hit * hit * 55, p.size * (1 - hit / p.life), p.angle + hit * p.spin, Math.pow(1 - hit / p.life, 1.5));
        }
        for (let i = 0; i < 5; i++) sprite(2, targetX + Math.cos(i * 1.26) * hit * 80, targetY + Math.sin(i * 1.26) * hit * 60, 80 + hit * 150, i + hit, Math.max(0, .14 - hit * .12));
        if (hit < .55) {
          ctx.strokeStyle = blocked ? "#b9e7ff" : color;
          ctx.lineWidth = 4 * (1 - hit / .55);
          ctx.globalAlpha = (1 - hit / .55) * .8;
          ctx.beginPath();
          ctx.ellipse(targetX, targetY, 20 + hit * (field ? width * 1.2 : 320), 15 + hit * (field ? height : 220), -.15, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      if (elapsed < 1.5) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { stopped = true; cancelAnimationFrame(frame); ctx.clearRect(0, 0, width, height); };
  }, [color, side, skill, field, blocked, reduced]);
  return <canvas ref={ref} data-battle-particles aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 4 }} />;
}
