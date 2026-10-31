import { Link2Off, Users } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { membersRepository } from "@/modules/members/members.repository";
import { inviteTokenParam } from "@/modules/members/members.schemas";
import { checkInvite } from "@/modules/members/members.service";
import { AcceptForm } from "./accept-form";

// Enlace de invitación (/invitacion/<token>): no entra solo, la persona elige su etiqueta y confirma.
export default function InvitationPage({
  params,
}: PageProps<"/invitacion/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-5 md:p-8">
      <p className="font-display text-4xl leading-none">
        topochito<span className="text-primary">.</span>
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
  params: PageProps<"/invitacion/[token]">["params"];
}) {
  await connection(); // la vigencia se mide al pedir la página, nunca en el prerender
  const token = inviteTokenParam.safeParse((await params).token);
  const invite = token.success
    ? await checkInvite(membersRepository, token.data, new Date())
    : null;

  if (!token.success || !invite?.ok) {
    const expired = invite && !invite.ok && invite.error !== "invalid";
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <Link2Off />
          <AlertTitle className="font-bold">
            {expired
              ? "Esta invitación ya no está activa"
              : "Esta invitación no es válida"}
          </AlertTitle>
          <AlertDescription>
            Pide a tu familia que te envíe una invitación nueva desde «Mi
            recetario».
          </AlertDescription>
        </Alert>
        <Link
          href="/acceso#codigo"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full",
          )}
        >
          Tengo el código de la familia
        </Link>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Users className="size-10 text-primary" aria-hidden />
        <h1 className="text-[28px] leading-tight font-bold">
          Te invitaron a la familia {invite.householdName}
        </h1>
        <p className="text-lg xl:text-base">
          Si no esperabas esta invitación, puedes cerrar esta página.
        </p>
        <AcceptForm token={token.data} name={invite.householdName} />
      </CardContent>
    </Card>
  );
}
