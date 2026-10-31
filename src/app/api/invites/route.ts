import { requireSession } from "@/lib/current-session";
import { handle, json } from "@/lib/http";
import { membersRepository } from "@/modules/members/members.repository";
import type { Invite } from "@/modules/members/members.schemas";
import { createInviteToken } from "@/modules/members/members.service";

const toInvite = (r: { id: string; expiresAt: Date }): Invite => ({
  id: r.id,
  expiresAt: r.expiresAt.toISOString(),
});

export const GET = handle(async () => {
  const { householdId } = await requireSession();
  const rows = await membersRepository.activeInvites(householdId);
  return json({ invites: rows.map(toInvite) });
});

// El token solo viaja en esta respuesta: en la base queda su hash.
export const POST = handle(async () => {
  const { householdId } = await requireSession();
  const { token, tokenHash, expiresAt } = createInviteToken(new Date());
  const id = await membersRepository.createInvite(
    householdId,
    tokenHash,
    expiresAt,
  );
  return json({ invite: toInvite({ id, expiresAt }), token }, { status: 201 });
});
