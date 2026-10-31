import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { recipesRepository } from "@/modules/recipes/recipes.repository";
import { listAllergens } from "@/modules/recipes/recipes.service";
import { OnboardingScreen } from "./onboarding-screen";

export const metadata = { title: "Crear recetario · topochito" };

// Pública (sin sesión): los alérgenos se leen aquí porque /api/allergens está tras el gate.
export default function EmpezarPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-5 md:p-8">
      <p className="font-display text-[32px] leading-tight">
        topochito<span className="text-primary">.</span>
      </p>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Screen />
      </Suspense>
    </main>
  );
}

async function Screen() {
  await connection(); // solo en cada petición: el build no consulta la base
  return (
    <OnboardingScreen allergens={await listAllergens(recipesRepository)} />
  );
}
