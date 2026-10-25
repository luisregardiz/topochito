import { describe, expect, it } from "vitest";
import {
  authenticate,
  generateAccessCode,
  hashAccessCode,
  normalizeAccessCode,
  verifyAccessCode,
} from "./households.service";

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

  it("hash y verificación, tolerante al formato", async () => {
    const hash = await hashAccessCode("ABCD-2345");
    expect(hash).not.toContain("ABCD");
    expect(await verifyAccessCode("abcd 2345", hash)).toBe(true);
    expect(await verifyAccessCode("ABCD-2346", hash)).toBe(false);
  });

  it("authenticate devuelve la familia correcta o null", async () => {
    const repo = {
      listAll: async () => [
        {
          id: "1",
          name: "Uno",
          accessCodeHash: await hashAccessCode("AAAA-1111"),
        },
        {
          id: "2",
          name: "Dos",
          accessCodeHash: await hashAccessCode("BBBB-2222"),
        },
      ],
    };
    expect(await authenticate(repo, "bbbb-2222")).toEqual({
      id: "2",
      name: "Dos",
    });
    expect(await authenticate(repo, "CCCC-3333")).toBeNull();
  });
});
