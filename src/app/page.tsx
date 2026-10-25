import { LogoutButton } from "./logout-button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Recetario</h1>
      <LogoutButton />
    </main>
  );
}
