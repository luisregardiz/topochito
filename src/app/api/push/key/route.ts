import { requireSession } from "@/lib/current-session";
import { handle, json } from "@/lib/http";
import { vapidConfig } from "@/lib/push";

// Clave pública VAPID para suscribirse; null si el push no está configurado (la UI oculta el botón).
export const GET = handle(async () => {
  await requireSession();
  return json({ publicKey: vapidConfig()?.publicKey ?? null });
});
