"use client";

import { useEffect } from "react";

// Registra /sw.js en producción (en desarrollo estorbaría con la recarga en caliente).
export function ServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => {
      console.warn("[sw] no se pudo registrar", e);
    });
  }, []);
  return null;
}

// Los datos de la API guardados sin conexión son de una familia: se borran al entrar o salir.
export async function clearPrivateCaches() {
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith("api-") || k.startsWith("pages-"))
        .map((k) => caches.delete(k)),
    );
  } catch {
    // sin Cache API (navegador viejo o contexto no seguro): nada que borrar
  }
}
