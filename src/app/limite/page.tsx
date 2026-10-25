import { Suspense } from "react";
import { Countdown } from "./countdown";

// Destino de los 429 en páginas (proxy.ts). Las respuestas de /api/* siguen siendo JSON.
export default function LimitePage({ searchParams }: PageProps<"/limite">) {
  return (
    <main className="flex flex-1 items-center p-5">
      <Suspense fallback={null}>
        <Wait searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Wait({
  searchParams,
}: {
  searchParams: PageProps<"/limite">["searchParams"];
}) {
  const { s } = await searchParams;
  const n = Number(Array.isArray(s) ? s[0] : s);
  const seconds =
    Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 3600) : 60;
  return <Countdown seconds={seconds} />;
}
