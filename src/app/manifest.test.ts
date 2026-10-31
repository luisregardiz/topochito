import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { config } from "@/proxy";
import manifest from "./manifest";

describe("manifest de la PWA", () => {
  const m = manifest();

  it("es instalable: standalone, nombre e iconos 192 y 512 que existen en public/", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/hoy");
    expect(m.name).toBe("topochito");
    const sizes = m.icons!.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    for (const i of m.icons!) expect(existsSync(`public${i.src}`)).toBe(true);
    expect(existsSync("public/apple-touch-icon.png")).toBe(true);
  });

  it("el manifiesto y los iconos quedan fuera del gate de sesión de proxy.ts", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test("/manifest.webmanifest")).toBe(false);
    expect(re.test("/sw.js")).toBe(false); // el navegador lo pide sin cookie al registrarlo
    for (const i of m.icons!) expect(re.test(i.src)).toBe(false);
    expect(re.test("/menu")).toBe(true);
  });
});
