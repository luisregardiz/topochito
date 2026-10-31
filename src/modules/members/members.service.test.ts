import { describe, expect, it } from "vitest";
import {
  acceptInvite,
  checkInvite,
  createInviteToken,
  hashToken,
  legacyMemberId,
  LEGACY_MEMBER_LABEL,
  resolveMember,
  revokeMember,
} from "./members.service";

const H = "7d3f1c0e-9a4b-4c1e-8f2a-1b2c3d4e5f60";
const OTHER = "0d3f1c0e-9a4b-4c1e-8f2a-1b2c3d4e5f60";
const NOW = new Date("2026-10-30T12:00:00Z");

function memberRepo(householdExists = true) {
  const rows = new Map<
    string,
    { id: string; householdId: string; label: string; revokedAt: Date | null }
  >();
  const touched: string[] = [];
  return {
    rows,
    touched,
    find: async (id: string) => rows.get(id),
    ensure: async (id: string, householdId: string, label: string) => {
      if (!householdExists) return false;
      if (!rows.has(id))
        rows.set(id, { id, householdId, label, revokedAt: null });
      return true;
    },
    touch: async (id: string) => void touched.push(id),
  };
}

describe("sesiones y cuidadores", () => {
  it("una cookie vieja (sin memberId) crea su cuidador al vuelo y pide reemitir la cookie", async () => {
    const repo = memberRepo();
    const session = { householdId: H, memberId: null, issuedAt: 1_700_000_000 };
    const r = await resolveMember(repo, session);
    expect(r).toEqual({
      householdId: H,
      memberId: legacyMemberId(H, 1_700_000_000),
      upgraded: true,
    });
    expect(repo.rows.get(r!.memberId)?.label).toBe(LEGACY_MEMBER_LABEL);
  });

  it("varias peticiones simultáneas con la misma cookie vieja crean un solo cuidador", async () => {
    const repo = memberRepo();
    const session = { householdId: H, memberId: null, issuedAt: 42 };
    const [a, b] = await Promise.all([
      resolveMember(repo, session),
      resolveMember(repo, session),
    ]);
    expect(a!.memberId).toBe(b!.memberId);
    expect(repo.rows.size).toBe(1);
    // otra cookie (otro dispositivo, otro iat) es otro cuidador
    expect(legacyMemberId(H, 43)).not.toBe(a!.memberId);
    expect(legacyMemberId(H, 42)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("cookie vieja de una familia borrada: sin sesión", async () => {
    expect(
      await resolveMember(memberRepo(false), {
        householdId: H,
        memberId: null,
        issuedAt: 1,
      }),
    ).toBeNull();
  });

  it("cuidador vigente: pasa y renueva su último acceso; revocado o de otra familia: no", async () => {
    const repo = memberRepo();
    repo.rows.set("m1", {
      id: "m1",
      householdId: H,
      label: "Mamá",
      revokedAt: null,
    });
    repo.rows.set("m2", {
      id: "m2",
      householdId: H,
      label: "Niñera",
      revokedAt: NOW,
    });
    const s = (memberId: string, householdId = H) => ({
      householdId,
      memberId,
      issuedAt: 1,
    });
    expect(await resolveMember(repo, s("m1"))).toMatchObject({
      memberId: "m1",
      upgraded: false,
    });
    expect(repo.touched).toEqual(["m1"]);
    expect(await resolveMember(repo, s("m2"))).toBeNull();
    expect(await resolveMember(repo, s("m1", OTHER))).toBeNull();
    expect(await resolveMember(repo, s("no-existe"))).toBeNull();
  });

  it("no se puede revocar a uno mismo; revocar a otro inexistente da not_found", async () => {
    const revoked: string[] = [];
    const repo = {
      revoke: async (_h: string, id: string) => {
        if (id === "nadie") return false;
        revoked.push(id);
        return true;
      },
    };
    expect(await revokeMember(repo, H, "m1", "m1")).toEqual({
      ok: false,
      error: "self",
    });
    expect(await revokeMember(repo, H, "m1", "nadie")).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await revokeMember(repo, H, "m1", "m2")).toEqual({ ok: true });
    expect(revoked).toEqual(["m2"]);
  });
});

describe("invitaciones", () => {
  const fixedRandom = (n: number) => Buffer.alloc(n, 7);

  function inviteRepo() {
    const invites = new Map<
      string,
      {
        householdId: string;
        householdName: string;
        tokenHash: string;
        expiresAt: Date;
        revokedAt: Date | null;
      }
    >();
    const created: { householdId: string; label: string }[] = [];
    return {
      invites,
      created,
      findInvite: async (hash: string) => invites.get(hash),
      create: async (householdId: string, label: string) => {
        created.push({ householdId, label });
        return `m${created.length}`;
      },
    };
  }
  const issue = (repo: ReturnType<typeof inviteRepo>, at = NOW) => {
    const t = createInviteToken(at, fixedRandom);
    repo.invites.set(t.tokenHash, {
      householdId: H,
      householdName: "Familia Pérez",
      tokenHash: t.tokenHash,
      expiresAt: t.expiresAt,
      revokedAt: null,
    });
    return t;
  };

  it("el token tiene 32 bytes (43 caracteres base64url), vence a los 7 días y solo se guarda su hash", () => {
    const t = createInviteToken(NOW);
    expect(t.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(t.tokenHash).toBe(hashToken(t.token));
    expect(t.tokenHash).not.toContain(t.token);
    expect(t.expiresAt.getTime() - NOW.getTime()).toBe(7 * 24 * 3600 * 1000);
  });

  it("válida: muestra la familia y al canjearla crea el cuidador con su etiqueta", async () => {
    const repo = inviteRepo();
    const { token } = issue(repo);
    expect(await checkInvite(repo, token, NOW)).toEqual({
      ok: true,
      householdId: H,
      householdName: "Familia Pérez",
    });
    expect(await acceptInvite(repo, token, "Abuela", NOW)).toEqual({
      ok: true,
      householdId: H,
      memberId: "m1",
    });
    expect(repo.created).toEqual([{ householdId: H, label: "Abuela" }]);
  });

  it("canjeada: es multiuso, sigue valiendo para otra persona mientras no venza", async () => {
    const repo = inviteRepo();
    const { token } = issue(repo);
    await acceptInvite(repo, token, "Abuela", NOW);
    const later = new Date(NOW.getTime() + 6 * 24 * 3600 * 1000);
    expect(await acceptInvite(repo, token, "Niñera", later)).toMatchObject({
      ok: true,
      memberId: "m2",
    });
  });

  it("vencida: a los 7 días deja de servir y no crea a nadie", async () => {
    const repo = inviteRepo();
    const { token, expiresAt } = issue(repo);
    expect(await acceptInvite(repo, token, "Tía", expiresAt)).toEqual({
      ok: false,
      error: "expired",
    });
    expect(repo.created).toEqual([]);
  });

  it("revocada: deja de servir aunque no haya vencido", async () => {
    const repo = inviteRepo();
    const { token, tokenHash } = issue(repo);
    repo.invites.get(tokenHash)!.revokedAt = NOW;
    expect(await checkInvite(repo, token, NOW)).toEqual({
      ok: false,
      error: "revoked",
    });
  });

  it("token desconocido: inválida", async () => {
    expect(await checkInvite(inviteRepo(), "x".repeat(43), NOW)).toEqual({
      ok: false,
      error: "invalid",
    });
  });
});
