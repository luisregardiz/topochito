import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

const secret = "a".repeat(32);
const id = "7d3f1c0e-9a4b-4c1e-8f2a-1b2c3d4e5f60";

describe("session", () => {
  it("firma y verifica el householdId", async () => {
    expect(await verifySession(await signSession(id, secret), secret)).toEqual({
      householdId: id,
    });
  });

  it("rechaza secreto distinto, token roto y token ausente", async () => {
    const token = await signSession(id, secret);
    expect(await verifySession(token, "b".repeat(32))).toBeNull();
    expect(await verifySession(`${token}x`, secret)).toBeNull();
    expect(await verifySession(undefined, secret)).toBeNull();
  });

  it("rechaza tokens expirados y subjects que no son uuid", async () => {
    const key = new TextEncoder().encode(secret);
    const expired = await new SignJWT()
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(id)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(key);
    const badSub = await new SignJWT()
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("no-es-uuid")
      .sign(key);
    expect(await verifySession(expired, secret)).toBeNull();
    expect(await verifySession(badSub, secret)).toBeNull();
  });
});
