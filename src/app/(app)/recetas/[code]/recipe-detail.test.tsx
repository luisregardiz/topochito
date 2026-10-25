// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/test/render";
import type { RecipeDetail } from "@/modules/recipes/recipes.schemas";
import { RecipeDetailScreen } from "./recipe-detail";

const get = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn() }));
const copyText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { get },
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/clipboard", () => ({ copyText }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

const d10: RecipeDetail = {
  code: "D10",
  title: "Arepita dominó: caraotas negras y queso fresco",
  mealType: "desayuno",
  minAgeMonths: 7,
  isIronSource: true,
  ironNote: null,
  note: "La harina de maíz precocida está enriquecida con hierro.",
  allergens: [
    { slug: "lacteos", name: "Lácteos", isOptional: false, condition: null },
  ],
  ingredients: [
    "1–2 arepitas blandas (P5)",
    "3 cdas de caraotas negras",
    "1 cda de queso fresco",
  ],
  steps: ["Calienta las caraotas.", "Abre las arepitas y úntalas."],
  ageAdaptations: [
    {
      minAgeMonths: 7,
      maxAgeMonths: 8,
      instructions: "Tiras de arepa untadas, sin costra dura.",
    },
    { minAgeMonths: 9, maxAgeMonths: 11, instructions: "Trocitos rellenos." },
    {
      minAgeMonths: 12,
      maxAgeMonths: null,
      instructions: "Arepa dominó entera.",
    },
  ],
  tags: [{ slug: "harina-enriquecida", label: "Harina enriquecida" }],
  uses: [
    { code: "P3", title: "Caraotas negras base (sin sal)" },
    { code: "P5", title: "Masa de arepitas blandas (sin sal)" },
  ],
};

beforeEach(() => {
  get.mockReset();
  toast.success.mockReset();
  copyText.mockReset();
});

describe("detalle de receta", () => {
  it("muestra título, insignias, ingredientes, pasos y recetas relacionadas", async () => {
    get.mockResolvedValue({ data: d10 });
    renderWithQuery(<RecipeDetailScreen code="D10" />);

    expect(
      await screen.findByRole("heading", { name: /Arepita dominó/ }),
    ).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/recipes/D10", expect.anything());
    expect(screen.getByText("Desde 7 meses")).toBeTruthy();
    expect(screen.getByText("Fuente de hierro")).toBeTruthy();
    expect(screen.getByText("Contiene lácteos")).toBeTruthy();
    expect(screen.getByText("Harina enriquecida")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByText("Calienta las caraotas.")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Caraotas negras base/ })
        .getAttribute("href"),
    ).toBe("/recetas/P3");
    expect(screen.getByText("Notas importantes")).toBeTruthy();
  });

  it("marca ingredientes y copia la lista", async () => {
    get.mockResolvedValue({ data: d10 });
    const user = userEvent.setup();
    renderWithQuery(<RecipeDetailScreen code="D10" />);

    const [first] = await screen.findAllByRole("checkbox");
    await user.click(first!);
    await waitFor(() =>
      expect(first!.getAttribute("aria-checked")).toBe("true"),
    );

    await user.click(
      screen.getByRole("button", { name: /Copiar ingredientes/ }),
    );
    expect(copyText).toHaveBeenCalledWith(d10.ingredients.join("\n"));
    expect(toast.success).toHaveBeenCalledWith("Ingredientes copiados");
  });

  it("cambia la adaptación según el tramo de edad elegido", async () => {
    get.mockResolvedValue({ data: d10 });
    const user = userEvent.setup();
    renderWithQuery(<RecipeDetailScreen code="D10" />);

    expect(
      await screen.findByText("Tiras de arepa untadas, sin costra dura."),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "9–11 meses" }));
    expect(await screen.findByText("Trocitos rellenos.")).toBeTruthy();
    expect(
      screen.queryByText("Tiras de arepa untadas, sin costra dura."),
    ).toBeNull();
  });

  it("una nota de seguridad se presenta como precaución", async () => {
    get.mockResolvedValue({
      data: {
        ...d10,
        note: "La crema de maní nunca se da sola ni a cucharadas.",
      },
    });
    renderWithQuery(<RecipeDetailScreen code="D10" />);
    expect(await screen.findByText("Precaución al preparar")).toBeTruthy();
  });

  it("receta inexistente: mensaje claro y salida al catálogo", async () => {
    const { ApiError } = await import("@/lib/api-client");
    get.mockRejectedValue(
      new ApiError(404, "not_found", "Receta no encontrada"),
    );
    renderWithQuery(<RecipeDetailScreen code="Z99" />);
    expect(await screen.findByText("No encontramos esa receta")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Ver todas las recetas" })
        .getAttribute("href"),
    ).toBe("/recetas");
  });
});
