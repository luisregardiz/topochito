import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
} from "node:crypto";
import { checkBirth } from "@/modules/babies/baby.service";
import { CREATOR_MEMBER_LABEL } from "@/modules/members/members.service";
import type { OnboardingInput } from "./households.schemas";

// Sin 0/O, 1/I/L ni U/V: legible al dictarlo por teléfono.
const ALPHABET = "ABCDEFGHJKMNPQRSTWXYZ23456789";
const CODE_LENGTH = 8;

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

// Dos subclaves independientes (índice y cifrado) derivadas de ACCESS_CODE_KEY.
export function deriveCodeKeys(secret: string) {
  const derive = (info: string) =>
    Buffer.from(hkdfSync("sha256", secret, "", info, 32));
  return {
    lookup: derive("access-code-lookup"),
    enc: derive("access-code-enc"),
  };
}
export type CodeKeys = ReturnType<typeof deriveCodeKeys>;

export function lookupCode(code: string, keys: CodeKeys) {
  return createHmac("sha256", keys.lookup)
    .update(normalizeAccessCode(code))
    .digest("hex");
}

export function encryptCode(code: string, keys: CodeKeys) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys.enc, iv);
  const data = Buffer.concat([
    cipher.update(normalizeAccessCode(code), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString("base64"))
    .join(".");
}

// Devuelve el código con formato XXXX-XXXX.
export function decryptCode(blob: string, keys: CodeKeys) {
  const [iv, tag, data] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  if (!iv || !tag || !data) throw new Error("código cifrado inválido");
  const decipher = createDecipheriv("aes-256-gcm", keys.enc, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]).toString("utf8");
  return `${plain.slice(0, 4)}-${plain.slice(4)}`;
}

type HouseholdRow = { id: string; name: string; accessCodeEnc: string };
type InsertRow = {
  name: string;
  accessCodeLookup: string;
  accessCodeEnc: string;
};

export async function authenticate(
  repo: {
    findByLookup: (
      lookup: string,
    ) => Promise<{ id: string; name: string } | undefined>;
  },
  code: string,
  keys: CodeKeys,
) {
  return (await repo.findByLookup(lookupCode(code, keys))) ?? null;
}

// Devuelve null si ya se alcanzó el tope de familias. `insert` puede crear más cosas en la misma transacción
// (cuidador, bebé…) y devolverlas junto al id.
export async function createHousehold<R extends { id: string }>(
  repo: {
    insert: (row: InsertRow) => Promise<R | undefined>;
    count: () => Promise<number>;
  },
  name: string,
  keys: CodeKeys,
  {
    maxHouseholds = Infinity,
    rand,
  }: { maxHouseholds?: number; rand?: (max: number) => number } = {},
) {
  if ((await repo.count()) >= maxHouseholds) return null;
  // El índice es único: ante una colisión (≈ imposible) se genera otro código.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateAccessCode(rand);
    const row = await repo.insert({
      name,
      accessCodeLookup: lookupCode(code, keys),
      accessCodeEnc: encryptCode(code, keys),
    });
    if (row) return { ...row, name, code };
  }
  throw new Error("no se pudo generar un código único");
}

// Código nuevo para la familia: el anterior deja de servir (las sesiones abiertas siguen).
export async function regenerateCode(
  repo: {
    updateCode: (
      householdId: string,
      row: Omit<InsertRow, "name">,
    ) => Promise<boolean>; // false ante colisión del índice único
  },
  householdId: string,
  keys: CodeKeys,
  rand?: (max: number) => number,
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateAccessCode(rand);
    const updated = await repo.updateCode(householdId, {
      accessCodeLookup: lookupCode(code, keys),
      accessCodeEnc: encryptCode(code, keys),
    });
    if (updated) return code;
  }
  throw new Error("no se pudo generar un código único");
}

export type FamilyExtras = Omit<
  OnboardingInput,
  "name" | "website" | "label"
> & {
  label: string;
};
export type StartFamilyError =
  "future_date" | "too_old" | "unknown_allergen" | "signup_closed";

// Alta autoservicio (/empezar): familia, su primer cuidador y el bebé, en una sola transacción.
export async function startFamily(
  repo: {
    allergenSlugs: () => Promise<string[]>;
    count: () => Promise<number>;
    insertFamily: (
      row: InsertRow,
      extras: FamilyExtras,
    ) => Promise<{ id: string; memberId: string } | undefined>;
  },
  input: OnboardingInput,
  keys: CodeKeys,
  {
    now,
    maxHouseholds,
    rand,
  }: { now: Date; maxHouseholds?: number; rand?: (max: number) => number },
): Promise<
  | { ok: true; householdId: string; memberId: string; code: string }
  | { ok: false; error: StartFamilyError }
> {
  const invalid = checkBirth(input.baby, now);
  if (invalid) return { ok: false, error: invalid };
  const known = new Set(await repo.allergenSlugs());
  if (input.baby.introduced.some((s) => !known.has(s)))
    return { ok: false, error: "unknown_allergen" };

  const { name, label, baby, mealTimes, country, timeZone } = input;
  const extras: FamilyExtras = {
    baby,
    mealTimes,
    country,
    timeZone,
    label: label || CREATOR_MEMBER_LABEL,
  };
  const created = await createHousehold(
    {
      count: repo.count,
      insert: (row) => repo.insertFamily(row, extras),
    },
    name,
    keys,
    { maxHouseholds, rand },
  );
  if (!created) return { ok: false, error: "signup_closed" };
  return {
    ok: true,
    householdId: created.id,
    memberId: created.memberId,
    code: created.code,
  };
}

export function shareCodeOf(household: HouseholdRow, keys: CodeKeys) {
  return {
    id: household.id,
    name: household.name,
    code: decryptCode(household.accessCodeEnc, keys),
  };
}

export const INACTIVE_DAYS = 30;

// Borra las familias sin visitas desde hace `days` días. Con dryRun solo cuenta.
export async function purgeInactive(
  repo: {
    countInactive: (cutoff: Date) => Promise<number>;
    deleteInactive: (cutoff: Date) => Promise<number>;
  },
  {
    now,
    days = INACTIVE_DAYS,
    dryRun = false,
  }: { now: Date; days?: number; dryRun?: boolean },
) {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const count = dryRun
    ? await repo.countInactive(cutoff)
    : await repo.deleteInactive(cutoff);
  return {
    dryRun,
    inactiveDays: days,
    [dryRun ? "wouldDelete" : "deleted"]: count,
  };
}
