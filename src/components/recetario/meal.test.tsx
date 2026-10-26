// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MealThumb, RecipeImage, RecipeVideo } from "./meal";

const URL_IMG =
  "https://res.cloudinary.com/demo/image/upload/c_fill/recetario/D10";
const VIDEO = {
  src: "https://res.cloudinary.com/demo/video/upload/q_auto/recetario/D10-video.mp4",
  poster:
    "https://res.cloudinary.com/demo/video/upload/so_0/recetario/D10-video.jpg",
};

describe("MealThumb", () => {
  it("sin foto muestra el placeholder de la comida, sin imagen rota", () => {
    const { container } = render(<MealThumb meal="desayuno" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.firstElementChild?.className).toContain(
      "bg-meal-desayuno",
    );
  });

  it("con foto la carga de forma diferida y decorativa", () => {
    const { container } = render(<MealThumb meal="almuerzo" src={URL_IMG} />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(URL_IMG);
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("alt")).toBe("");
  });

  it("si la imagen falla, vuelve al placeholder", () => {
    const { container } = render(<MealThumb meal="merienda" src={URL_IMG} />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("RecipeImage", () => {
  it("sin foto muestra el nombre de la comida en un 4:3", () => {
    const { container } = render(<RecipeImage meal="cena" alt="Foto de X" />);
    expect(screen.getByText("Cena")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstElementChild?.className).toContain("aspect-[4/3]");
  });

  it("con foto la muestra con prioridad y texto alternativo", () => {
    render(<RecipeImage meal="desayuno" src={URL_IMG} alt="Foto de Arepita" />);
    const img = screen.getByRole("img", { name: "Foto de Arepita" });
    expect(img.getAttribute("src")).toBe(URL_IMG);
    expect(img.getAttribute("fetchpriority")).toBe("high");
    expect(img.getAttribute("loading")).toBeNull(); // la principal no es diferida
  });

  it("si la foto falla, vuelve al placeholder", () => {
    render(<RecipeImage meal="desayuno" src={URL_IMG} alt="Foto de Arepita" />);
    fireEvent.error(screen.getByRole("img", { name: "Foto de Arepita" }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Desayuno")).toBeTruthy();
  });
});

describe("RecipeVideo", () => {
  it("al inicio solo carga el póster: no hay <video> ni descarga del archivo", () => {
    const { container } = render(<RecipeVideo video={VIDEO} title="Arepita" />);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")!.getAttribute("src")).toBe(
      VIDEO.poster,
    );
    expect(
      screen.getByRole("button", { name: /Reproducir video/ }),
    ).toBeTruthy();
  });

  it("al pulsar reproduce el mp4 con controles", async () => {
    const user = userEvent.setup();
    const { container } = render(<RecipeVideo video={VIDEO} title="Arepita" />);
    await user.click(screen.getByRole("button", { name: /Reproducir video/ }));

    const video = container.querySelector("video")!;
    expect(video.getAttribute("src")).toBe(VIDEO.src);
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.getAttribute("aria-label")).toBe(
      "Video de la preparación: Arepita",
    );
    expect(
      screen.queryByRole("button", { name: /Reproducir video/ }),
    ).toBeNull();
  });
});
