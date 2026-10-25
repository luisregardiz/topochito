import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

// Sin 0/O, 1/I/L ni U/V: legible al dictarlo por teléfono.
const ALPHABET = "ABCDEFGHJKMNPQRSTWXYZ23456789";
const CODE_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

export function generateAccessCode(rand: (max: number) => number = randomInt) {
  const chars = Array.from(
    { length: CODE_LENGTH },
    () => ALPHABET[rand(ALPHABET.length)]!,
  );
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export function normalizeAccessCode(input: string) {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function hashAccessCode(code: string) {
  return bcrypt.hash(normalizeAccessCode(code), BCRYPT_ROUNDS);
}

export function verifyAccessCode(code: string, hash: string) {
  return bcrypt.compare(normalizeAccessCode(code), hash);
}

type HouseholdRow = { id: string; name: string; accessCodeHash: string };

// shortcut: el hash es salado, así que se compara contra cada familia (O(n) bcrypts);
// sirve para decenas de familias, con cientos habría que añadir un prefijo público al código.
export async function authenticate(
  repo: { listAll: () => Promise<HouseholdRow[]> },
  code: string,
) {
  for (const h of await repo.listAll()) {
    if (await verifyAccessCode(code, h.accessCodeHash))
      return { id: h.id, name: h.name };
  }
  return null;
}
