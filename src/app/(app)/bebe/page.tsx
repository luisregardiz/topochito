import { BabyScreen } from "./baby-screen";

export default function BebePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-5 pb-28 md:p-8 md:pb-8">
      <header>
        <h1 className="font-display text-[40px] leading-none md:text-5xl xl:text-[40px]">
          Bebé
        </h1>
        <p className="mt-2 text-muted-foreground">
          Con la edad ajustamos las recetas y con los alérgenos las filtramos.
        </p>
      </header>
      <BabyScreen />
    </main>
  );
}
