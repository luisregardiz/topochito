import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
} from "node:crypto";

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

export async function createHousehold(
  repo: { insert: (row: InsertRow) => Promise<{ id: string } | undefined> },
  name: string,
  keys: CodeKeys,
  rand?: (max: number) => number,
) {
  // El índice es único: ante una colisión (≈ imposible) se genera otro código.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateAccessCode(rand);
    const row = await repo.insert({
      name,
      accessCodeLookup: lookupCode(code, keys),
      accessCodeEnc: encryptCode(code, keys),
    });
    if (row) return { id: row.id, name, code };
  }
  throw new Error("no se pudo generar un código único");
}

export function shareCodeOf(household: HouseholdRow, keys: CodeKeys) {
  return {
    id: household.id,
    name: household.name,
    code: decryptCode(household.accessCodeEnc, keys),
  };
}
