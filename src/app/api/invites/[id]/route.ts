import { requireSession } from "@/lib/current-session";
import { handle, HttpError, json } from "@/lib/http";
import { membersRepository } from "@/modules/members/members.repository";
import { inviteIdParam } from "@/modules/members/members.schemas";

export const DELETE = handle(
  async (_req, { params }: RouteContext<"/api/invites/[id]">) => {
    const { householdId } = await requireSession();
    const id = inviteIdParam.parse((await params).id);
    if (!(await membersRepository.revokeInvite(householdId, id)))
      throw new HttpError(404, "not_found", "Esa invitación no existe");
    return json({ ok: true });
  },
);
