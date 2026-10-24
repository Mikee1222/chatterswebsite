/**
 * Client-safe perceptual hash helpers (average hash / aHash).
 * Used for duplicate detection across video analyses for the same model.
 */

/** 8×8 grayscale average-hash → 16-char hex. */
export function aHashFromImageData(data: ImageData): string {
  const { width, height, data: pixels } = data;
  const size = 8;
  const grays: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x / size) * width);
      const sy = Math.floor((y / size) * height);
      const i = (sy * width + sx) * 4;
      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      grays.push(0.299 * r + 0.587 * g + 0.114 * b);
    }
  }
  const avg = grays.reduce((a, b) => a + b, 0) / grays.length;
  let bits = "";
  for (const g of grays) bits += g >= avg ? "1" : "0";
  // 64 bits → 16 hex chars
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/** Hamming distance between two equal-length hex hashes. */
export function hammingHex(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    dist += bitCount4(x);
  }
  return dist;
}

function bitCount4(n: number): number {
  let c = 0;
  let v = n;
  while (v) {
    c += v & 1;
    v >>= 1;
  }
  return c;
}

/**
 * Similarity 0–100 between two hash arrays (best pairwise average of top matches).
 */
export function hashSetSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const scores: number[] = [];
  for (const ha of a) {
    let best = 0;
    for (const hb of b) {
      const dist = hammingHex(ha, hb);
      const sim = Math.max(0, 1 - dist / 64);
      if (sim > best) best = sim;
    }
    scores.push(best);
  }
  const avg = scores.reduce((x, y) => x + y, 0) / scores.length;
  return Math.round(avg * 100);
}
