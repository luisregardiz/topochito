import { PantryScreen } from "./pantry-screen";

export default function DespensaPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-5 pb-28 md:p-8 md:pb-8">
      <header>
        <h1 className="font-display text-[32px] leading-tight md:text-4xl xl:text-[32px]">
          Mi despensa
        </h1>
        <p className="mt-2 text-muted-foreground">
          Marca lo que compras normalmente. Desmarca lo que no consigues y no te
          propondremos recetas que lo necesiten.
        </p>
      </header>
      <PantryScreen />
    </main>
  );
}
