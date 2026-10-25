import Link from "next/link";
import { Suspense } from "react";
import { getCodeKeys } from "@/modules/households/households.keys";
import { householdsRepository } from "@/modules/households/households.repository";
import { accessInput } from "@/modules/households/households.schemas";
import { authenticate } from "@/modules/households/households.service";
import { JoinButton } from "./join-button";

// Enlace de familia: /join/XXXX-XXXX. Pide confirmar antes de iniciar sesión (un GET no debe cambiar de cuenta).
export default function JoinPage({ params }: PageProps<"/join/[code]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <Invitation params={params} />
      </Suspense>
    </main>
  );
}

async function Invitation({
  params,
}: {
  params: PageProps<"/join/[code]">["params"];
}) {
  const parsed = accessInput.safeParse({ code: (await params).code });
  const household = parsed.success
    ? await authenticate(householdsRepository, parsed.data.code, getCodeKeys())
    : null;

  if (!household) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Este enlace no es válido</h1>
        <p className="text-base">
          Pídele a quien te lo compartió que te lo envíe de nuevo, o escribe el
          código a mano.
        </p>
        <Link href="/acceso" className="text-base underline">
          Ir a escribir el código
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-semibold">
        Te invitaron al recetario de {household.name}
      </h1>
      <p className="text-base">
        Si no esperabas esta invitación, puedes cerrar esta página.
      </p>
      <JoinButton code={parsed.data!.code} />
    </>
  );
}
