import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppNav } from "@/components/recetario/app-nav";
import { getCurrentHousehold } from "@/modules/households/current-household";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col xl:flex-row">
      <Suspense fallback={null}>
        <Nav />
      </Suspense>
      <div className="flex-1 pb-[76px] md:pb-0">{children}</div>
    </div>
  );
}

// También cuenta como visita (evita la purga) y atrapa la sesión de un recetario que ya se borró.
async function Nav() {
  const household = await getCurrentHousehold();
  if (!household) redirect("/acceso?motivo=borrado");
  return <AppNav familyName={household.name} />;
}
