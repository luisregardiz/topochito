import { Clock } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentHousehold } from "@/modules/households/current-household";
import { RecetarioActions } from "./recetario-actions";

export default function RecetarioPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-5 md:p-8">
      <h1 className="font-display text-[40px] leading-none md:text-5xl">
        Mi recetario
      </h1>
      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <Panel />
      </Suspense>
    </main>
  );
}

async function Panel() {
  const household = await getCurrentHousehold();
  if (!household) redirect("/acceso?motivo=borrado");

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="text-base text-muted-foreground">Familia</p>
            <p className="text-[28px] leading-tight font-bold">
              {household.name}
            </p>
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-base text-muted-foreground">Código de acceso</p>
            <p className="rounded-md bg-muted px-4 py-3 text-center font-mono text-[30px] tracking-[0.12em]">
              {household.code}
            </p>
            <p className="text-base">
              Con este código cualquier persona de la familia puede entrar.
            </p>
          </div>
          <RecetarioActions code={household.code} />
        </CardContent>
      </Card>
      <Alert>
        <Clock />
        <AlertTitle className="font-bold">
          Si nadie abre este recetario en 30 días, se borra
        </AlertTitle>
      </Alert>
    </>
  );
}
