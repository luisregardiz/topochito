import { Suspense } from "react";
import { AccessScreen } from "./access-screen";

export default function AccesoPage({ searchParams }: PageProps<"/acceso">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-5 md:max-w-3xl md:p-8">
      <Suspense fallback={null}>
        <Screen searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Screen({
  searchParams,
}: {
  searchParams: PageProps<"/acceso">["searchParams"];
}) {
  const { motivo } = await searchParams;
  return <AccessScreen deleted={motivo === "borrado"} />;
}
