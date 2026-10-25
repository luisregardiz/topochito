import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": r("./src"),
      "server-only": r("./src/test/server-only-stub.ts"), // fuera de Next, `server-only` lanza
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup-dom.ts"], // los tests de componentes activan jsdom con `// @vitest-environment jsdom`
  },
});
