import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BASE = {
  DATABASE_URL: "postgres://x",
  SESSION_SECRET: "s".repeat(32),
  ACCESS_CODE_KEY: "k".repeat(32),
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
  KV_REST_API_URL: "",
  KV_REST_API_TOKEN: "",
};

async function load(extra: Record<string, string>) {
  for (const [k, v] of Object.entries({ ...BASE, ...extra })) vi.stubEnv(k, v);
  vi.resetModules(); // getEnv guarda el resultado en caché
  return (await import("./env")).getEnv();
}

describe("getEnv: Upstash", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it("toma KV_REST_API_* de la integración de Vercel", async () => {
    const env = await load({
      KV_REST_API_URL: "https://kv.example",
      KV_REST_API_TOKEN: "tok",
    });
    expect(env.UPSTASH_REDIS_REST_URL).toBe("https://kv.example");
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBe("tok");
  });

  it("las UPSTASH_* explícitas tienen prioridad", async () => {
    const env = await load({
      UPSTASH_REDIS_REST_URL: "https://own.example",
      UPSTASH_REDIS_REST_TOKEN: "own",
      KV_REST_API_URL: "https://kv.example",
      KV_REST_API_TOKEN: "tok",
    });
    expect(env.UPSTASH_REDIS_REST_URL).toBe("https://own.example");
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBe("own");
  });

  it("sin ninguna de las dos queda sin Upstash (límite en memoria)", async () => {
    const env = await load({});
    expect(env.UPSTASH_REDIS_REST_URL).toBeUndefined();
  });

  it("URL sin token sigue siendo un error", async () => {
    await expect(
      load({ KV_REST_API_URL: "https://kv.example" }),
    ).rejects.toThrow(/van juntas/);
  });
});
