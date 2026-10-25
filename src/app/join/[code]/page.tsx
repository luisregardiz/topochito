import { Link2Off, Keyboard, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFamilyCode } from "@/lib/family-code";
import { getCodeKeys } from "@/modules/households/households.keys";
import { householdsRepository } from "@/modules/households/households.repository";
import { accessInput } from "@/modules/households/households.schemas";
import { authenticate } from "@/modules/households/households.service";
import { cn } from "@/lib/utils";
import { JoinButton } from "./join-button";

// Enlace de familia: /join/XXXX-XXXX. No entra solo: crear la sesión exige confirmar (un GET no cambia de cuenta).
export default function JoinPage({ params }: PageProps<"/join/[code]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-5 md:p-8">
      <p className="font-display text-[40px] leading-none">
        Recetario<span className="text-primary">.</span>
      </p>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
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

  if (!parsed.success || !household) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <Link2Off />
          <AlertTitle className="font-bold">
            Este enlace no es válido
          </AlertTitle>
          <AlertDescription>
            Puede que se haya copiado incompleto. Pide el código a quien te lo
            envió y escríbelo a mano.
          </AlertDescription>
        </Alert>
        <Link
          href="/acceso#codigo"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full",
          )}
        >
          <Keyboard aria-hidden /> Escribir el código a mano
        </Link>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Users className="size-10 text-primary" aria-hidden />
        <h1 className="text-[28px] leading-tight font-bold">
          Te invitaron al recetario de {household.name}
        </h1>
        <p className="text-base text-muted-foreground">
          Código{" "}
          <span className="font-mono tracking-[0.12em]">
            {formatFamilyCode(parsed.data.code)}
          </span>
        </p>
        <p className="text-lg xl:text-base">
          Si no esperabas esta invitación, puedes cerrar esta página.
        </p>
        <JoinButton code={parsed.data.code} name={household.name} />
      </CardContent>
    </Card>
  );
}
