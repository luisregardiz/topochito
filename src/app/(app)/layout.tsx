import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppNav } from "@/components/recetario/app-nav";
import { babyRepository } from "@/modules/babies/baby.repository";
import { getBaby } from "@/modules/babies/baby.service";
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
  const baby = await getBaby(babyRepository, household.id, new Date());
  return (
    <AppNav familyName={household.name} babyAge={baby?.ageMonths ?? null} />
  );
}
