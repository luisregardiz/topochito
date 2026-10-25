import { describe, expect, it } from "vitest";
import {
  authenticate,
  createHousehold,
  decryptCode,
  deriveCodeKeys,
  encryptCode,
  generateAccessCode,
  lookupCode,
  normalizeAccessCode,
} from "./households.service";

const keys = deriveCodeKeys("k".repeat(32));

describe("código de acceso", () => {
  it("genera XXXX-XXXX con el alfabeto sin ambiguos", () => {
    expect(generateAccessCode(() => 0)).toBe("AAAA-AAAA");
    expect(generateAccessCode()).toMatch(
      /^[A-HJKMNP-TW-Z2-9]{4}-[A-HJKMNP-TW-Z2-9]{4}$/,
    );
  });

  it("normaliza mayúsculas, espacios y guiones", () => {
    expect(normalizeAccessCode(" ab12-cd34 ")).toBe("AB12CD34");
  });

  it("el índice es estable, tolerante al formato y depende de la clave", () => {
    expect(lookupCode("abcd 2345", keys)).toBe(lookupCode("ABCD-2345", keys));
    expect(lookupCode("ABCD-2345", keys)).not.toBe(
      lookupCode("ABCD-2346", keys),
    );
    expect(lookupCode("ABCD-2345", keys)).not.toBe(
      lookupCode("ABCD-2345", deriveCodeKeys("z".repeat(32))),
    );
  });

  it("cifra y descifra devolviendo XXXX-XXXX, sin dejar el código en claro", () => {
    const blob = encryptCode("abcd2345", keys);
    expect(blob).not.toContain("ABCD");
    expect(decryptCode(blob, keys)).toBe("ABCD-2345");
    expect(encryptCode("ABCD-2345", keys)).not.toBe(blob); // IV aleatorio
  });

  it("no descifra con otra clave ni con datos alterados", () => {
    const blob = encryptCode("ABCD-2345", keys);
    expect(() => decryptCode(blob, deriveCodeKeys("z".repeat(32)))).toThrow();
    expect(() => decryptCode(`${blob.slice(0, -2)}AA`, keys)).toThrow();
    expect(() => decryptCode("basura", keys)).toThrow();
  });
});

describe("familias", () => {
  const memoryRepo = () => {
    const rows: { id: string; name: string; accessCodeLookup: string }[] = [];
    return {
      rows,
      insert: async (r: {
        name: string;
        accessCodeLookup: string;
        accessCodeEnc: string;
      }) => {
        if (rows.some((x) => x.accessCodeLookup === r.accessCodeLookup))
          return undefined;
        const row = {
          id: String(rows.length + 1),
          name: r.name,
          accessCodeLookup: r.accessCodeLookup,
        };
        rows.push(row);
        return row;
      },
      findByLookup: async (l: string) =>
        rows.find((x) => x.accessCodeLookup === l),
    };
  };

  it("crea una familia y se entra con el código devuelto (en cualquier formato)", async () => {
    const repo = memoryRepo();
    const created = await createHousehold(repo, "Los Pérez", keys);
    expect(created.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(
      await authenticate(repo, created.code.toLowerCase(), keys),
    ).toMatchObject({ name: "Los Pérez" });
    expect(await authenticate(repo, "AAAA-AAAA", keys)).toBeNull();
  });

  it("ante colisión de código genera otro", async () => {
    const repo = memoryRepo();
    await createHousehold(repo, "Primera", keys, () => 0); // AAAA-AAAA
    const seq = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]; // AAAA-AAAA y luego BBBB-BBBB
    let i = 0;
    const second = await createHousehold(
      repo,
      "Segunda",
      keys,
      () => seq[i++]!,
    );
    expect(second.code).toBe("BBBB-BBBB");
  });
});
