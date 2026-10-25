import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Solo aplica en los tests con jsdom; en los de lógica (entorno node) no hace nada.
if (typeof window !== "undefined") {
  afterEach(cleanup);
  window.matchMedia ??= vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  // jsdom no trae PointerEvent y Base UI lo usa en clics
  window.PointerEvent ??=
    class PointerEvent extends MouseEvent {} as typeof window.PointerEvent;
  Element.prototype.getAnimations ??= () => []; // Base UI lo consulta al abrir/cerrar Sheet y Dialog
  Element.prototype.scrollIntoView ??= vi.fn();
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
}
