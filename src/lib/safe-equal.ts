import { timingSafeEqual } from "node:crypto";

// Comparación en tiempo constante para tokens y hashes (no revela cuántos caracteres coinciden).
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
