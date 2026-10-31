import { requireSession } from "@/lib/current-session";
import { handle, HttpError, json } from "@/lib/http";
import { membersRepository } from "@/modules/members/members.repository";
import { memberIdParam } from "@/modules/members/members.schemas";
import { revokeMember } from "@/modules/members/members.service";

// Revoca a un cuidador: su próxima petición recibe 401 y su cookie se borra.
export const DELETE = handle(
  async (_req, { params }: RouteContext<"/api/members/[id]">) => {
    const { householdId, memberId } = await requireSession();
    const target = memberIdParam.parse((await params).id);
    const result = await revokeMember(
      membersRepository,
      householdId,
      memberId,
      target,
    );
    if (!result.ok) {
      throw result.error === "self"
        ? new HttpError(422, "self", "Para salir tú, usa «Salir»")
        : new HttpError(404, "not_found", "Ese cuidador no existe");
    }
    return json({ ok: true });
  },
);
