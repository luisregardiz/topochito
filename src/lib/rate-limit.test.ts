import { describe, expect, it } from "vitest";
import { createMemoryRateLimiter } from "./rate-limit";

describe("createMemoryRateLimiter", () => {
  it("permite hasta el límite y luego bloquea con Retry-After", async () => {
    let t = 0;
    const rl = createMemoryRateLimiter(
      { limit: 2, windowSeconds: 60 },
      () => t,
    );
    expect((await rl.limit("ip")).success).toBe(true);
    expect((await rl.limit("ip")).success).toBe(true);
    t = 10_000;
    expect(await rl.limit("ip")).toEqual({
      success: false,
      retryAfterSeconds: 50,
    });
  });

  it("reinicia al terminar la ventana y separa claves", async () => {
    let t = 0;
    const rl = createMemoryRateLimiter(
      { limit: 1, windowSeconds: 60 },
      () => t,
    );
    await rl.limit("a");
    expect((await rl.limit("a")).success).toBe(false);
    expect((await rl.limit("b")).success).toBe(true);
    t = 60_000;
    expect((await rl.limit("a")).success).toBe(true);
  });
});
