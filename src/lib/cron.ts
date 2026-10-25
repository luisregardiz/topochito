import { timingSafeEqual } from "node:crypto";

// Vercel Cron envía `Authorization: Bearer <CRON_SECRET>`. Sin secreto configurado, el endpoint queda cerrado.
export function isCronAuthorized(
  header: string | null,
  secret: string | undefined,
) {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
