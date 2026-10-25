"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const subscribe = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

// Banner no bloqueante: se puede seguir navegando.
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <Alert
      variant="warning"
      className="fixed inset-x-0 top-0 z-50 rounded-none border-x-0 border-t-0"
    >
      <WifiOff />
      <AlertTitle className="font-bold">Sin conexión.</AlertTitle>
      <AlertDescription>
        Puedes ver lo que ya abriste. Para cambiar el menú hace falta internet.
      </AlertDescription>
    </Alert>
  );
}
