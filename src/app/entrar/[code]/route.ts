import { NextResponse } from "next/server";
import { handle } from "@/lib/http";
import { startSession } from "@/lib/start-session";
import { getCodeKeys } from "@/modules/households/households.keys";
import { householdsRepository } from "@/modules/households/households.repository";
import { accessInput } from "@/modules/households/households.schemas";
import { authenticate } from "@/modules/households/households.service";

// Enlace de familia: /entrar/XXXX-XXXX. Inicia sesión y redirige a una URL sin el código.
export const GET = handle(async (req, ctx: RouteContext<"/entrar/[code]">) => {
  const { code } = await ctx.params;
  const parsed = accessInput.safeParse({ code });
  const household = parsed.success
    ? await authenticate(householdsRepository, parsed.data.code, getCodeKeys())
    : null;
  if (!household)
    return NextResponse.redirect(new URL("/acceso?error=codigo", req.url));

  await startSession(household.id);
  return NextResponse.redirect(new URL("/", req.url));
});
