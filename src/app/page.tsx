import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentHousehold } from "@/modules/households/current-household";
import { LogoutButton } from "./logout-button";
import { ShareButton } from "./share-button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  const household = await getCurrentHousehold();
  if (!household) redirect("/acceso"); // sesión de una familia que ya no existe

  return (
    <>
      <h1 className="text-3xl font-semibold">Recetario de {household.name}</h1>
      <p className="text-base">
        Código de la familia:{" "}
        <strong className="tracking-widest">{household.code}</strong>
      </p>
      <ShareButton code={household.code} name={household.name} />
      <LogoutButton />
    </>
  );
}
