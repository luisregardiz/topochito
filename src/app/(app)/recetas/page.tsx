import { RecipesScreen } from "./recipes-screen";

export default function RecetasPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-5 md:p-8">
      <h1 className="font-display text-[32px] leading-tight md:text-4xl xl:text-[32px]">
        Recetas
      </h1>
      <RecipesScreen />
    </main>
  );
}
