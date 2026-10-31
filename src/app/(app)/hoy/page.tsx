import { TodayScreen } from "./today-screen";

export const metadata = { title: "Hoy · topochito" };

export default function HoyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-5 md:p-8">
      <TodayScreen />
    </main>
  );
}
