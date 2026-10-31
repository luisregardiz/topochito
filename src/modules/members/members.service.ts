import { createHash } from "node:crypto";
import { safeEqual } from "@/lib/safe-equal";
import { hashToken, newToken } from "@/lib/tokens";
import type { Session } from "@/lib/session";

export const INVITE_DAYS = 7;
export const LEGACY_MEMBER_LABEL = "Dispositivo anterior";
export const CREATOR_MEMBER_LABEL = "Quien creó el recetario";
export const CODE_MEMBER_LABEL = "Entró con el código";

type MemberRow = { id: string; householdId: string; revokedAt: Date | null };

// Una cookie vieja (sin cuidador) siempre da el mismo id: varias peticiones simultáneas crean un solo miembro.
export function legacyMemberId(householdId: string, issuedAt: number) {
  const h = createHash("sha256")
    .update(`legacy:${householdId}:${issuedAt}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// Sesión válida = firma correcta (proxy.ts) + cuidador existente y no revocado (aquí).
// Las cookies viejas crean su cuidador al vuelo; `upgraded` pide reemitir la cookie con el memberId.
export async function resolveMember(
  repo: {
    find: (id: string) => Promise<MemberRow | undefined>;
    ensure: (
      id: string,
      householdId: string,
      label: string,
    ) => Promise<boolean>; // false si la familia ya no existe
    touch: (id: string) => Promise<void>;
  },
  session: Session,
) {
  const { householdId } = session;
  if (!session.memberId) {
    const id = legacyMemberId(householdId, session.issuedAt);
    if (!(await repo.ensure(id, householdId, LEGACY_MEMBER_LABEL))) return null;
    const row = await repo.find(id);
    if (!row || row.revokedAt) return null;
    return { householdId, memberId: id, upgraded: true };
  }
  const row = await repo.find(session.memberId);
  if (!row || row.householdId !== householdId || row.revokedAt) return null;
  await repo.touch(row.id);
  return { householdId, memberId: row.id, upgraded: false };
}

export type RevokeError = "not_found" | "self";

export async function revokeMember(
  repo: {
    revoke: (householdId: string, memberId: string) => Promise<boolean>;
  },
  householdId: string,
  actorId: string,
  targetId: string,
): Promise<{ ok: true } | { ok: false; error: RevokeError }> {
  if (actorId === targetId) return { ok: false, error: "self" }; // para irse está «Salir»
  return (await repo.revoke(householdId, targetId))
    ? { ok: true }
    : { ok: false, error: "not_found" };
}

// --- Invitaciones -----------------------------------------------------------

export { hashToken };

export function createInviteToken(now: Date, random?: (n: number) => Buffer) {
  return {
    ...newToken(random),
    expiresAt: new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000),
  };
}

type InviteRow = {
  householdId: string;
  householdName: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type InviteError = "invalid" | "expired" | "revoked";

// Multiuso: canjearla no la gasta; deja de valer al vencer o al revocarla.
export async function checkInvite(
  repo: { findInvite: (tokenHash: string) => Promise<InviteRow | undefined> },
  token: string,
  now: Date,
): Promise<
  | { ok: true; householdId: string; householdName: string }
  | { ok: false; error: InviteError }
> {
  const hash = hashToken(token);
  const row = await repo.findInvite(hash);
  if (!row || !safeEqual(row.tokenHash, hash))
    return { ok: false, error: "invalid" };
  if (row.revokedAt) return { ok: false, error: "revoked" };
  if (row.expiresAt <= now) return { ok: false, error: "expired" };
  return {
    ok: true,
    householdId: row.householdId,
    householdName: row.householdName,
  };
}

export async function acceptInvite(
  repo: {
    findInvite: (tokenHash: string) => Promise<InviteRow | undefined>;
    create: (householdId: string, label: string) => Promise<string>;
  },
  token: string,
  label: string,
  now: Date,
) {
  const invite = await checkInvite(repo, token, now);
  if (!invite.ok) return invite;
  const memberId = await repo.create(invite.householdId, label);
  return { ok: true as const, householdId: invite.householdId, memberId };
}
