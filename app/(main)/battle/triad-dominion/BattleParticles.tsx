"use client";

import { useEffect, useRef } from "react";
import type { TriadElement } from "@/lib/triad-dominion";
import { BATTLE_CONTACT_MS, BATTLE_HIT_STOP_MS } from "./BattleTiming";

const textures = ["spark_01", "flare_01", "smoke_01", "slash_01", "magic_01"];

export default function BattleParticles({ color, element, side, skill, skillRecipient, field, blocked, reduced, effect }: {
  color: string; element: TriadElement; side: "player" | "opponent"; skill: boolean; field: boolean; blocked: boolean; reduced: boolean;
  effect?: "buff" | "debuff" | "shift" | "transform" | "swap";
  skillRecipient?: "player" | "opponent" | "both";
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
    // Local coordinates also work when the entire mobile arena is rotated.
    const target = canvas.parentElement?.querySelector<HTMLElement>('[data-fighter="target"]');
    const source = canvas.parentElement?.querySelector<HTMLElement>('[data-fighter="source"]');
    const sourceX = skill ? width / 2 : source ? source.offsetLeft + source.offsetWidth / 2 : width * (side === "player" ? .23 : .77);
    const recipient = skill && skillRecipient !== "both" ? canvas.parentElement?.querySelector<HTMLElement>(`[data-side="${skillRecipient || side}"]`) : target;
    const targetX = skill && skillRecipient === "both" ? width / 2 : recipient ? recipient.offsetLeft + recipient.offsetWidth / 2 : width * (side === "player" ? .77 : .23);
    const targetY = recipient ? recipient.offsetTop + recipient.offsetHeight / 2 : height * .39;
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
      const realElapsed = (now - startedAt) / 1000;
      const contact = BATTLE_CONTACT_MS / 1000;
      const stop = BATTLE_HIT_STOP_MS / 1000;
      const elapsed = !skill && realElapsed > contact ? realElapsed < contact + stop ? contact : realElapsed - stop : realElapsed;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      // Energy gathers first; particles release on the same frame as card contact.
      if (elapsed < contact) {
        const charge = Math.min(elapsed / contact, 1);
        const x = sourceX + (targetX - sourceX) * Math.max(0, (charge - .4) / .6);
        sprite(skill ? 4 : 1, x, targetY, 55 + charge * 160, elapsed * 2, charge * .7);
        for (let i = 0; i < 10; i++) sprite(0, x + Math.cos(i + elapsed * 8) * 55 * (1 - charge), targetY + Math.sin(i + elapsed * 8) * 55 * (1 - charge), 16, i, charge);
      }
      const hit = elapsed - contact;
      if (hit >= 0) {
        const flash = Math.max(0, 1 - hit * 8);
        sprite(1, targetX, targetY, (mobile ? 240 : 420) + hit * 200, 0, flash);
        sprite(blocked ? 4 : 3, targetX, targetY, mobile ? 190 : 310, side === "player" ? -.7 : .7, Math.max(0, 1 - hit * 3));
        for (const [i, p] of particles.entries()) {
          if (hit > p.life) continue;
          const distance = p.speed * hit;
          const x = targetX + Math.cos(p.angle) * distance;
          const y = targetY + Math.sin(p.angle) * distance + hit * hit * (element === "earth" ? 180 : 55);
          const size = p.size * (1 - hit / p.life);
          const opacity = Math.pow(1 - hit / p.life, 1.5);
          if (blocked || element === "gold" || element === "unknown") {
            sprite(0, x, y, size, p.angle + hit * p.spin, opacity);
          } else if (element === "fire") {
            sprite(i % 3 ? 0 : 1, x, y - hit * 70, size * (i % 3 ? 1 : 2), p.angle, opacity);
          } else {
            ctx.save(); ctx.globalAlpha = opacity; ctx.fillStyle = color;
            ctx.translate(x, y); ctx.rotate(p.angle + hit * p.spin);
            ctx.beginPath();
            if (element === "earth") {
              ctx.moveTo(-size / 2, -size / 3); ctx.lineTo(size / 4, -size / 2);
              ctx.lineTo(size / 2, size / 3); ctx.lineTo(-size / 3, size / 2); ctx.closePath();
            } else {
              ctx.ellipse(0, 0, size * (element === "wood" ? .65 : .3), size * .65, 0, 0, Math.PI * 2);
            }
            ctx.fill(); ctx.restore();
          }
        }
        if (element === "fire" || element === "earth") for (let i = 0; i < 5; i++) sprite(2, targetX + Math.cos(i * 1.26) * hit * 80, targetY + Math.sin(i * 1.26) * hit * 60, 80 + hit * 150, i + hit, Math.max(0, .14 - hit * .12));
        if (!blocked && hit < .75) {
          ctx.save(); ctx.globalAlpha = Math.max(0, 1 - hit / .75); ctx.strokeStyle = color;
          const extent = Math.min(hit * 600 + 35, mobile ? 100 : 180);
          if (element === "wood") {
            ctx.lineWidth = 4;
            for (let i = 0; i < 5; i++) {
              const angle = i * Math.PI * .4;
              ctx.beginPath(); ctx.moveTo(targetX + Math.cos(angle) * extent, targetY + Math.sin(angle) * extent);
              ctx.quadraticCurveTo(targetX + Math.cos(angle + .8) * extent * .6, targetY + Math.sin(angle + .8) * extent * .6, targetX, targetY); ctx.stroke();
            }
          } else if (element === "earth") {
            ctx.lineWidth = 2;
            for (let i = 0; i < 7; i++) {
              const angle = i * .9;
              ctx.beginPath(); ctx.moveTo(targetX, targetY);
              ctx.lineTo(targetX + Math.cos(angle) * extent * .55, targetY + Math.sin(angle) * extent * .55);
              ctx.lineTo(targetX + Math.cos(angle + .18) * extent, targetY + Math.sin(angle + .18) * extent); ctx.stroke();
            }
          } else if (element === "water") {
            ctx.lineWidth = 3;
            for (let i = 0; i < 3; i++) {
              ctx.beginPath(); ctx.ellipse(targetX, targetY, extent * (1 + i * .25), extent * (.45 + i * .1), -.25, 0, Math.PI * 2); ctx.stroke();
            }
          } else if (element === "gold") {
            ctx.lineWidth = 2; ctx.beginPath();
            for (let i = 0; i <= 6; i++) {
              const angle = i * Math.PI / 3 + hit;
              const x = targetX + Math.cos(angle) * extent;
              const y = targetY + Math.sin(angle) * extent;
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          if (effect === "buff" || effect === "debuff") {
            ctx.lineWidth = 3;
            const direction = effect === "debuff" ? 1 : -1;
            for (let i = 0; i < 5; i++) {
              const x = targetX + (i - 2) * 24;
              const y = targetY + direction * hit * 100;
              ctx.beginPath(); ctx.moveTo(x - 7, y - direction * 7); ctx.lineTo(x, y); ctx.lineTo(x + 7, y - direction * 7); ctx.stroke();
            }
          }
          ctx.restore();
        }
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
      if (realElapsed < 2.4) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { stopped = true; cancelAnimationFrame(frame); ctx.clearRect(0, 0, width, height); };
  }, [color, element, side, skill, skillRecipient, field, blocked, reduced, effect]);
  return <canvas ref={ref} data-battle-particles data-particle-element={element} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 4 }} />;
}
