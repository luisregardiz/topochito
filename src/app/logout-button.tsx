"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="underline"
      onClick={async () => {
        await fetch("/api/access/logout", { method: "POST" });
        router.replace("/acceso");
        router.refresh();
      }}
    >
      Salir
    </button>
  );
}
