import { describe, expect, it } from "vitest";
import {
  heroUrl,
  isValidPublicId,
  thumbUrl,
  videoPosterUrl,
  videoUrl,
} from "./cloudinary-url";

describe("URLs de Cloudinary", () => {
  it("miniatura cuadrada y imagen 4:3 con formato y calidad automáticos", () => {
    expect(thumbUrl("mi-cuenta", "recetario/D10")).toBe(
      "https://res.cloudinary.com/mi-cuenta/image/upload/c_fill,g_auto,w_176,h_176,f_auto,q_auto/recetario/D10",
    );
    expect(heroUrl("mi-cuenta", "recetario/D10")).toBe(
      "https://res.cloudinary.com/mi-cuenta/image/upload/c_fill,g_auto,ar_4:3,w_1000,f_auto,q_auto/recetario/D10",
    );
  });

  it("video en mp4 y póster del primer fotograma", () => {
    expect(videoUrl("mi-cuenta", "recetario/D10-video")).toBe(
      "https://res.cloudinary.com/mi-cuenta/video/upload/q_auto,w_1280/recetario/D10-video.mp4",
    );
    expect(videoPosterUrl("mi-cuenta", "recetario/D10-video")).toContain(
      "/video/upload/so_0,",
    );
    expect(videoPosterUrl("mi-cuenta", "recetario/D10-video")).toMatch(
      /\.jpg$/,
    );
  });

  it("codifica el nombre de la cuenta", () => {
    expect(thumbUrl("a b/c", "x")).toContain("/a%20b%2Fc/");
  });

  it("solo acepta public IDs seguros para la ruta", () => {
    for (const ok of ["recetario/D10", "recetario/D10-video", "a_b-c/1"])
      expect(isValidPublicId(ok)).toBe(true);
    for (const bad of [
      "",
      "../secreto",
      "a b",
      "a?x=1",
      "a#b",
      "a\\b",
      "x".repeat(201),
      "a.b/../c",
    ])
      expect(isValidPublicId(bad)).toBe(false);
  });
});
