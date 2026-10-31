import { handle, HttpError, json, parseJson } from "@/lib/http";
import { startSession } from "@/lib/start-session";
import { membersRepository } from "@/modules/members/members.repository";
import {
  acceptInviteInput,
  inviteTokenParam,
} from "@/modules/members/members.schemas";
import {
  acceptInvite,
  checkInvite,
  type InviteError,
} from "@/modules/members/members.service";

// Pública (se autentica por el token) y con rate limit propio en proxy.ts.
const ERRORS: Record<InviteError, [number, string]> = {
  invalid: [404, "Esta invitación no es válida"],
  expired: [410, "Esta invitación venció"],
  revoked: [410, "Esta invitación ya no está activa"],
};
const fail = (error: InviteError): never => {
  const [status, message] = ERRORS[error];
  throw new HttpError(status, error, message);
};
const tokenOf = async (params: Promise<{ token: string }>) => {
  const parsed = inviteTokenParam.safeParse((await params).token);
  return parsed.success ? parsed.data : fail("invalid");
};

export const GET = handle(
  async (_req, { params }: RouteContext<"/api/invitations/[token]">) => {
    const result = await checkInvite(
      membersRepository,
      await tokenOf(params),
      new Date(),
    );
    if (!result.ok) return fail(result.error);
    return json({ householdName: result.householdName });
  },
);

// Canjear: crea el cuidador con su etiqueta y le da su propia sesión.
export const POST = handle(
  async (req, { params }: RouteContext<"/api/invitations/[token]">) => {
    const token = await tokenOf(params);
    const { label } = await parseJson(req, acceptInviteInput, 256);
    const result = await acceptInvite(
      membersRepository,
      token,
      label,
      new Date(),
    );
    if (!result.ok) return fail(result.error);
    await startSession(result.householdId, result.memberId);
    return json({ ok: true });
  },
);
