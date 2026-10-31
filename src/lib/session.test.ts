import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

const secret = "a".repeat(32);
const id = "7d3f1c0e-9a4b-4c1e-8f2a-1b2c3d4e5f60";
const member = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

describe("session", () => {
  it("firma y verifica el householdId y el cuidador", async () => {
    expect(
      await verifySession(await signSession(id, member, secret), secret),
    ).toMatchObject({ householdId: id, memberId: member });
  });

  it("una cookie anterior a los cuidadores (sin mid) sigue valiendo, con memberId null", async () => {
    const legacy = await new SignJWT()
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(id)
      .setIssuedAt(1_700_000_000)
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(secret));
    expect(await verifySession(legacy, secret)).toEqual({
      householdId: id,
      memberId: null,
      issuedAt: 1_700_000_000,
    });
  });

  it("rechaza secreto distinto, token roto y token ausente", async () => {
    const token = await signSession(id, member, secret);
    expect(await verifySession(token, "b".repeat(32))).toBeNull();
    expect(await verifySession(`${token}x`, secret)).toBeNull();
    expect(await verifySession(undefined, secret)).toBeNull();
  });

  it("rechaza tokens expirados y subjects o miembros que no son uuid", async () => {
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
    const badMember = await new SignJWT({ mid: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(id)
      .sign(key);
    expect(await verifySession(expired, secret)).toBeNull();
    expect(await verifySession(badSub, secret)).toBeNull();
    expect(await verifySession(badMember, secret)).toBeNull();
  });
});
