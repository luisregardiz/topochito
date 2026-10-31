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
  purgeInactive,
  regenerateCode,
  startFamily,
} from "./households.service";
import { DEFAULT_MEAL_TIMES, isTimeZone } from "./households.schemas";
import type { OnboardingInput } from "./households.schemas";

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
      count: async () => rows.length,
      findByLookup: async (l: string) =>
        rows.find((x) => x.accessCodeLookup === l),
    };
  };

  it("crea una familia y se entra con el código devuelto (en cualquier formato)", async () => {
    const repo = memoryRepo();
    const created = await createHousehold(repo, "Los Pérez", keys);
    expect(created?.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(
      await authenticate(repo, created!.code.toLowerCase(), keys),
    ).toMatchObject({
      name: "Los Pérez",
    });
    expect(await authenticate(repo, "AAAA-AAAA", keys)).toBeNull();
  });

  it("ante colisión de código genera otro", async () => {
    const repo = memoryRepo();
    await createHousehold(repo, "Primera", keys, { rand: () => 0 }); // AAAA-AAAA
    const seq = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]; // AAAA-AAAA y luego BBBB-BBBB
    let i = 0;
    const second = await createHousehold(repo, "Segunda", keys, {
      rand: () => seq[i++]!,
    });
    expect(second?.code).toBe("BBBB-BBBB");
  });

  it("respeta el tope de familias (0 = cerrado)", async () => {
    const repo = memoryRepo();
    expect(
      await createHousehold(repo, "Primera", keys, { maxHouseholds: 1 }),
    ).not.toBeNull();
    expect(
      await createHousehold(repo, "Segunda", keys, { maxHouseholds: 1 }),
    ).toBeNull();
    expect(
      await createHousehold(memoryRepo(), "X", keys, { maxHouseholds: 0 }),
    ).toBeNull();
    expect(repo.rows).toHaveLength(1);
  });
});

describe("alta autoservicio y código nuevo", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  const input: OnboardingInput = {
    name: "Familia Pérez",
    label: "Mamá",
    website: "",
    baby: {
      nickname: "Topo",
      birthMonth: 3,
      birthYear: 2026,
      introduced: ["huevo"],
    },
    mealTimes: DEFAULT_MEAL_TIMES,
    country: "VE",
    timeZone: "America/Caracas",
  };
  const repo = () => {
    const families: { row: { name: string }; extras: unknown }[] = [];
    return {
      families,
      allergenSlugs: async () => ["huevo", "mani"],
      count: async () => families.length,
      insertFamily: async (row: { name: string }, extras: unknown) => {
        families.push({ row, extras });
        return { id: `h${families.length}`, memberId: "m1" };
      },
    };
  };

  it("crea familia, cuidador y bebé de una vez y devuelve el código", async () => {
    const r = repo();
    const result = await startFamily(r, input, keys, { now });
    expect(result).toMatchObject({
      ok: true,
      householdId: "h1",
      memberId: "m1",
    });
    expect(result.ok && result.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(r.families[0]!.row.name).toBe("Familia Pérez");
    expect(r.families[0]!.extras).toMatchObject({
      label: "Mamá",
      timeZone: "America/Caracas",
      baby: { nickname: "Topo", introduced: ["huevo"] },
    });
    expect(r.families[0]!.extras).not.toHaveProperty("website");
  });

  it("valida la fecha y los alérgenos antes de crear nada; respeta el tope", async () => {
    const r = repo();
    const future = { ...input, baby: { ...input.baby, birthYear: 2027 } };
    const unknown = { ...input, baby: { ...input.baby, introduced: ["x"] } };
    expect(await startFamily(r, future, keys, { now })).toEqual({
      ok: false,
      error: "future_date",
    });
    expect(await startFamily(r, unknown, keys, { now })).toEqual({
      ok: false,
      error: "unknown_allergen",
    });
    expect(r.families).toHaveLength(0);
    expect(
      await startFamily(r, input, keys, { now, maxHouseholds: 0 }),
    ).toEqual({ ok: false, error: "signup_closed" });
  });

  it("sin etiqueta, el primer cuidador queda como «Quien creó el recetario»", async () => {
    const r = repo();
    await startFamily(r, { ...input, label: undefined }, keys, { now });
    expect(r.families[0]!.extras).toMatchObject({
      label: "Quien creó el recetario",
    });
  });

  it("regenerar el código reintenta ante colisión y el código nuevo es el que entra", async () => {
    const taken = lookupCode("AAAA-AAAA", keys);
    const saved: string[] = [];
    const seq = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1];
    let i = 0;
    const code = await regenerateCode(
      {
        updateCode: async (_id, row) => {
          if (row.accessCodeLookup === taken) return false;
          saved.push(row.accessCodeLookup);
          return true;
        },
      },
      "h1",
      keys,
      () => seq[i++]!,
    );
    expect(code).toBe("BBBB-BBBB");
    expect(saved).toEqual([lookupCode("BBBB-BBBB", keys)]);
  });

  it("zona horaria: acepta IANA y rechaza inventos", () => {
    expect(isTimeZone("America/Santiago")).toBe(true);
    expect(isTimeZone("America/Argentina/Buenos_Aires")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Marte/Olympus")).toBe(false);
    expect(isTimeZone("GMT-4; DROP")).toBe(false);
  });
});

describe("purga por inactividad", () => {
  const now = new Date("2026-11-30T04:00:00Z");
  const fakeRepo = () => {
    const calls: string[] = [];
    return {
      calls,
      countInactive: async (c: Date) => (
        calls.push(`count ${c.toISOString()}`),
        3
      ),
      deleteInactive: async (c: Date) => (
        calls.push(`delete ${c.toISOString()}`),
        2
      ),
    };
  };

  it("borra con corte a 30 días", async () => {
    const repo = fakeRepo();
    expect(await purgeInactive(repo, { now })).toEqual({
      dryRun: false,
      inactiveDays: 30,
      deleted: 2,
    });
    expect(repo.calls).toEqual(["delete 2026-10-31T04:00:00.000Z"]);
  });

  it("dryRun solo cuenta y no borra", async () => {
    const repo = fakeRepo();
    expect(await purgeInactive(repo, { now, dryRun: true })).toEqual({
      dryRun: true,
      inactiveDays: 30,
      wouldDelete: 3,
    });
    expect(repo.calls).toEqual(["count 2026-10-31T04:00:00.000Z"]);
  });
});
