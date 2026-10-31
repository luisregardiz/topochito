// Detección en el navegador (solo llamar en el cliente).

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS se presenta como Mac

// localStorage puede no existir o lanzar (modo privado, datos bloqueados): nunca debe romper la pantalla.
export function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
export function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // sin almacenamiento: el aviso volverá a salir, no pasa nada
  }
}
