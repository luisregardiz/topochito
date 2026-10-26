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
  thumbUrl: null,
  imageUrl: null,
  video: null,
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

describe("detalle con el perfil del bebé", () => {
  const withMani: RecipeDetail = {
    ...d10,
    code: "D1",
    title: "Avena cremosa con cambur y maní",
    allergens: [
      { slug: "mani", name: "Maní", isOptional: false, condition: null },
      {
        slug: "lacteos",
        name: "Lácteos",
        isOptional: true,
        condition: "si usas leche",
      },
    ],
  };
  const baby = (ageMonths: number, allergens: Record<string, string>) => ({
    birthMonth: 3,
    birthYear: 2026,
    ageMonths,
    allergens,
  });

  function serve(recipe: RecipeDetail, b: ReturnType<typeof baby> | null) {
    get.mockImplementation(async (url: string) =>
      url === "/baby" ? { data: { baby: b } } : { data: recipe },
    );
  }

  it("avisa cuando la receta lleva un alérgeno que el bebé debe evitar", async () => {
    serve(withMani, baby(7, { mani: "avoid" }));
    renderWithQuery(<RecipeDetailScreen code="D1" />);

    expect(await screen.findByText("Tu bebé debe evitar el maní")).toBeTruthy();
    expect(
      screen.getByText(/En el perfil de tu bebé lo marcaste como «evitar»/),
    ).toBeTruthy();
    expect(screen.getByText("Maní · evitar")).toBeTruthy(); // insignia en rojo sólido
    expect(screen.getByText("Lácteos · si usas leche")).toBeTruthy(); // los demás se quedan como estaban
    expect(
      screen
        .getByRole("link", { name: /Ver recetas sin el maní/ })
        .getAttribute("href"),
    ).toBe("/recetas");
  });

  it("sin alérgenos a evitar no hay aviso, aunque ya los coma", async () => {
    serve(withMani, baby(7, { mani: "introduced" }));
    renderWithQuery(<RecipeDetailScreen code="D1" />);
    expect(await screen.findByText("Contiene maní")).toBeTruthy();
    expect(screen.queryByText(/Tu bebé debe evitar/)).toBeNull();
  });

  it("marca y preselecciona el tramo de edad del bebé", async () => {
    serve(d10, baby(10, {}));
    renderWithQuery(<RecipeDetailScreen code="D10" />);

    expect(await screen.findByText("✓ Tu bebé")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: /9–11 meses/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(await screen.findByText("Trocitos rellenos.")).toBeTruthy();
  });

  it("sin perfil, no hay marca «Tu bebé» y se muestra el primer tramo", async () => {
    serve(d10, null);
    renderWithQuery(<RecipeDetailScreen code="D10" />);
    expect(
      await screen.findByText("Tiras de arepa untadas, sin costra dura."),
    ).toBeTruthy();
    expect(screen.queryByText("✓ Tu bebé")).toBeNull();
  });
});

describe("detalle con foto y video", () => {
  const media = {
    ...d10,
    imageUrl:
      "https://res.cloudinary.com/demo/image/upload/c_fill/recetario/D10",
    video: {
      src: "https://res.cloudinary.com/demo/video/upload/q_auto/recetario/D10-video.mp4",
      poster:
        "https://res.cloudinary.com/demo/video/upload/so_0/recetario/D10-video.jpg",
    },
  };

  it("muestra la foto principal y, al final, la sección del video", async () => {
    get.mockResolvedValue({ data: media });
    renderWithQuery(<RecipeDetailScreen code="D10" />);

    const photo = await screen.findByRole("img", {
      name: `Foto de ${d10.title}`,
    });
    expect(photo.getAttribute("src")).toBe(media.imageUrl);
    expect(
      screen.getByRole("heading", { name: "Video de la preparación" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Reproducir video/ }),
    ).toBeTruthy();
  });

  it("sin video no hay sección, y sin foto se ve el placeholder 4:3", async () => {
    get.mockResolvedValue({ data: d10 });
    renderWithQuery(<RecipeDetailScreen code="D10" />);

    await screen.findByRole("heading", { name: /Arepita dominó/ });
    expect(
      screen.queryByRole("heading", { name: "Video de la preparación" }),
    ).toBeNull();
    expect(screen.queryByRole("img", { name: /Foto de/ })).toBeNull();
    expect(screen.getByText("Desayuno", { selector: "span" })).toBeTruthy(); // etiqueta del placeholder
  });
});
