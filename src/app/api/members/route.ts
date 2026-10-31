import { requireSession } from "@/lib/current-session";
import { handle, json } from "@/lib/http";
import { membersRepository } from "@/modules/members/members.repository";
import type { Member } from "@/modules/members/members.schemas";

export const GET = handle(async () => {
  const { householdId, memberId } = await requireSession();
  const rows = await membersRepository.list(householdId);
  const members: Member[] = rows.map((m) => ({
    id: m.id,
    label: m.label,
    lastSeenAt: m.lastSeenAt.toISOString(),
    createdAt: m.createdAt.toISOString(),
    isMe: m.id === memberId,
  }));
  return json({ members });
});
