import { AccessForm } from "./access-form";
import { CreateForm } from "./create-form";

export default function AccesoPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 p-6">
      <header>
        <h1 className="text-3xl font-semibold">Recetario para bebés</h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
          Recetas y menú de la semana para la alimentación de tu bebé.
        </p>
      </header>
      <CreateForm />
      <hr className="border-zinc-300 dark:border-zinc-700" />
      <AccessForm />
    </main>
  );
}
