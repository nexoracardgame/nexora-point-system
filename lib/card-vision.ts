"use client";

export type CardDescriptor = {
  cardNo: string;
  aHash: string;
  dHash: string;
  blocks: number[];
};

export type MatchResult = {
  cardNo: string;
  score: number;
  confidence: number;
  secondScore: number;
};

const INDEX_VERSION = "nexora-card-index-v1";
const CARD_COUNT = 293;

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`โหลดรูปไม่ได้: ${src}`));
    img.src = src;
  });
}

function drawCoverToCanvas(
  source: CanvasImageSource,
  targetW: number,
  targetH: number
) {
  const canvas = makeCanvas(targetW, targetH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context fail");

  const sw =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source instanceof HTMLCanvasElement
      ? source.width
      : source instanceof HTMLImageElement
      ? source.naturalWidth
      : (source as ImageBitmap).width;

  const sh =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source instanceof HTMLCanvasElement
      ? source.height
      : source instanceof HTMLImageElement
      ? source.naturalHeight
      : (source as ImageBitmap).height;

  const srcRatio = sw / sh;
  const dstRatio = targetW / targetH;

  let sx = 0;
  let sy = 0;
  let sWidth = sw;
  let sHeight = sh;

  if (srcRatio > dstRatio) {
    sHeight = sh;
    sWidth = sh * dstRatio;
    sx = (sw - sWidth) / 2;
  } else {
    sWidth = sw;
    sHeight = sw / dstRatio;
    sy = (sh - sHeight) / 2;
  }

  ctx.drawImage(source, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH);
  return canvas;
}

function getGrayPixels(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context fail");
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const gray = new Uint8Array(width * height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  return { gray, width, height };
}

function computeAHashFromCanvas(canvas: HTMLCanvasElement, size = 16) {
  const small = drawCoverToCanvas(canvas, size, size);
  const { gray } = getGrayPixels(small);

  let sum = 0;
  for (const v of gray) sum += v;
  const avg = sum / gray.length;

  let bits = "";
  for (const v of gray) bits += v >= avg ? "1" : "0";
  return bits;
}

function computeDHashFromCanvas(canvas: HTMLCanvasElement, width = 17, height = 16) {
  const small = drawCoverToCanvas(canvas, width, height);
  const { gray } = getGrayPixels(small);

  let bits = "";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const left = gray[y * width + x];
      const right = gray[y * width + x + 1];
      bits += left > right ? "1" : "0";
    }
  }
  return bits;
}

function computeBlockProfileFromCanvas(canvas: HTMLCanvasElement, cols = 4, rows = 4) {
  const small = drawCoverToCanvas(canvas, 32, 32);
  const { gray, width, height } = getGrayPixels(small);

  const blockW = width / cols;
  const blockH = height / rows;
  const out: number[] = [];

  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      let sum = 0;
      let count = 0;

      const startX = Math.floor(bx * blockW);
      const endX = Math.floor((bx + 1) * blockW);
      const startY = Math.floor(by * blockH);
      const endY = Math.floor((by + 1) * blockH);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          sum += gray[y * width + x];
          count++;
        }
      }

      out.push(Math.round(sum / Math.max(count, 1)));
    }
  }

  return out;
}

export function descriptorFromCanvas(canvas: HTMLCanvasElement): CardDescriptor {
  return {
    cardNo: "",
    aHash: computeAHashFromCanvas(canvas, 16),
    dHash: computeDHashFromCanvas(canvas, 17, 16),
    blocks: computeBlockProfileFromCanvas(canvas, 4, 4),
  };
}

function hamming(a: string, b: string) {
  const len = Math.min(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) diff++;
  }
  return diff + Math.abs(a.length - b.length);
}

function blockDistance(a: number[], b: number[]) {
  const len = Math.min(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < len; i++) {
    diff += Math.abs(a[i] - b[i]);
  }
  return diff / (len * 255);
}

function normalizeHamming(diff: number, length: number) {
  return length === 0 ? 1 : diff / length;
}

function scoreDescriptor(query: CardDescriptor, ref: CardDescriptor) {
  const a = normalizeHamming(hamming(query.aHash, ref.aHash), ref.aHash.length);
  const d = normalizeHamming(hamming(query.dHash, ref.dHash), ref.dHash.length);
  const b = blockDistance(query.blocks, ref.blocks);

  return a * 0.4 + d * 0.45 + b * 0.15;
}

async function buildDescriptorForCard(cardNo: string): Promise<CardDescriptor> {
  const src = `/cards/${cardNo}.jpg`;
  const img = await loadImage(src);
  const canvas = drawCoverToCanvas(img, 240, 340);
  const desc = descriptorFromCanvas(canvas);
  desc.cardNo = cardNo;
  return desc;
}

export async function warmupCardIndex(
  onProgress?: (done: number, total: number) => void
): Promise<CardDescriptor[]> {
  const cached = localStorage.getItem(INDEX_VERSION);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as CardDescriptor[];
      if (Array.isArray(parsed) && parsed.length >= CARD_COUNT) {
        onProgress?.(CARD_COUNT, CARD_COUNT);
        return parsed;
      }
    } catch {}
  }

  const all: CardDescriptor[] = [];

  for (let i = 1; i <= CARD_COUNT; i++) {
    const cardNo = pad3(i);
    try {
      const desc = await buildDescriptorForCard(cardNo);
      all.push(desc);
    } catch (err) {
      console.warn("index build skip", cardNo, err);
    }
    onProgress?.(i, CARD_COUNT);
  }

  localStorage.setItem(INDEX_VERSION, JSON.stringify(all));
  return all;
}

export function matchCardFromCanvas(
  queryCanvas: HTMLCanvasElement,
  index: CardDescriptor[]
): MatchResult | null {
  if (!index.length) return null;

  const query = descriptorFromCanvas(queryCanvas);

  const ranked = index
    .map((ref) => ({
      cardNo: ref.cardNo,
      score: scoreDescriptor(query, ref),
    }))
    .sort((a, b) => a.score - b.score);

  const best = ranked[0];
  const second = ranked[1] ?? ranked[0];

  const confidence = Math.max(
    0,
    Math.min(1, 1 - best.score - Math.max(0, 0.18 - (second.score - best.score)))
  );

  return {
    cardNo: best.cardNo,
    score: best.score,
    confidence,
    secondScore: second.score,
  };
}

export function shouldAcceptMatch(result: MatchResult | null) {
  if (!result) return false;

  const gap = result.secondScore - result.score;

  if (result.score <= 0.19 && gap >= 0.015) return true;
  if (result.score <= 0.16) return true;

  return false;
}