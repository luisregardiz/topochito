import { createHash, randomBytes } from "node:crypto";

// Tokens de enlace (invitación, calendario): 32 bytes aleatorios en base64url; en la base solo su SHA-256.
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function newToken(random: (n: number) => Buffer = randomBytes) {
  const token = random(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export const tokenParamPattern = /^[A-Za-z0-9_-]{43}$/;
