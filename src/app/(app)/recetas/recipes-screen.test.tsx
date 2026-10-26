// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/test/render";
import type { RecipeListItem } from "@/modules/recipes/recipes.schemas";
import { RecipesScreen } from "./recipes-screen";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { get },
}));

const recipe = (over: Partial<RecipeListItem>): RecipeListItem => ({
  code: "D1",
  title: "Avena cremosa con cambur y maní",
  mealType: "desayuno",
  minAgeMonths: 7,
  isIronSource: true,
  ironNote: "si usas avena enriquecida",
  thumbUrl: null,
  missingFoods: [],
  allergens: [
    { slug: "mani", name: "Maní", isOptional: false, condition: null },
  ],
  ...over,
});
const LIST = [
  recipe({}),
  recipe({
    code: "A6",
    title: "Pasta con salmón",
    mealType: "almuerzo",
    isIronSource: false,
    allergens: [],
  }),
];
const ALLERGENS = [
  { slug: "huevo", name: "Huevo" },
  { slug: "mani", name: "Maní" },
];

const lastRecipeParams = () =>
  get.mock.calls.filter(([url]) => url === "/recipes").at(-1)?.[1]
    .params as Record<string, unknown>;

const PANTRY = {
  foods: [],
  unavailable: [] as string[],
  recipes: { cookable: 71, total: 71 },
};
type Baby = {
  birthMonth: number;
  birthYear: number;
  ageMonths: number;
  allergens: Record<string, string>;
};

// Respuestas de cada endpoint que usa la pantalla del catálogo.
function serve(
  o: {
    baby?: Baby | null;
    pantry?: typeof PANTRY;
    recipes?: RecipeListItem[];
    fail?: boolean;
  } = {},
) {
  get.mockImplementation(async (url: string) => {
    if (url === "/allergens") return { data: { allergens: ALLERGENS } };
    if (url === "/baby") return { data: { baby: o.baby ?? null } };
    if (url === "/pantry") return { data: o.pantry ?? PANTRY };
    if (o.fail) throw new Error("red");
    return { data: { recipes: o.recipes ?? LIST } };
  });
}

beforeEach(() => {
  get.mockReset();
  serve();
});

describe("catálogo de recetas", () => {
  it("lista las recetas con su comida, insignias y enlace al detalle", async () => {
    renderWithQuery(<RecipesScreen />);
    const link = await screen.findByRole("link", { name: /Avena cremosa/ });
    expect(link.getAttribute("href")).toBe("/recetas/D1");
    expect(within(link).getByText("Hierro")).toBeTruthy();
    expect(within(link).getByText("Maní")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Pasta con salmón/ })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Guía de la despensa/ }),
    ).toBeTruthy();
  });

  it("busca con retraso y envía el texto al API", async () => {
    const user = userEvent.setup();
    renderWithQuery(<RecipesScreen />);
    await screen.findByRole("link", { name: /Avena cremosa/ });

    await user.type(screen.getByRole("searchbox"), "salmon");
    await waitFor(() => expect(lastRecipeParams().q).toBe("salmon"));
  });

  it("filtra por comida con los chips", async () => {
    const user = userEvent.setup();
    renderWithQuery(<RecipesScreen />);
    await screen.findByRole("link", { name: /Avena cremosa/ });

    await user.click(screen.getByRole("button", { name: /Desayuno/ }));
    await waitFor(() => expect(lastRecipeParams().meal).toBe("desayuno"));
    await user.click(screen.getByRole("button", { name: /Desayuno/ })); // al desmarcar vuelve a «Todas»
    await waitFor(() => expect(lastRecipeParams().meal).toBeUndefined());
  });

  it("el Sheet de filtros excluye alérgenos y lo resume", async () => {
    const user = userEvent.setup();
    renderWithQuery(<RecipesScreen />);
    await screen.findByRole("link", { name: /Avena cremosa/ });

    await user.click(screen.getByRole("button", { name: /Filtros/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Maní" }));

    await waitFor(() => expect(lastRecipeParams().exclude).toBe("mani"));
    expect(await screen.findAllByText(/sin maní/)).not.toHaveLength(0);

    await user.click(
      within(dialog).getByRole("button", { name: "Borrar filtros" }),
    );
    await waitFor(() => expect(lastRecipeParams().exclude).toBeUndefined());
  });

  it("sin resultados explica qué probar", async () => {
    serve({ recipes: [] });
    renderWithQuery(<RecipesScreen />);
    expect(await screen.findByText("No encontramos recetas")).toBeTruthy();
    expect(
      screen.getByText("Prueba con otra palabra o quita algún filtro."),
    ).toBeTruthy();
  });

  it("si falla la carga ofrece reintentar", async () => {
    serve({ fail: true });
    renderWithQuery(<RecipesScreen />);
    expect(
      await screen.findByText(
        "No se pudieron cargar las recetas",
        {},
        { timeout: 4000 },
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });
});

describe("catálogo con el perfil del bebé", () => {
  const BABY = {
    birthMonth: 3,
    birthYear: 2026,
    ageMonths: 7,
    allergens: { mani: "avoid", huevo: "introduced" },
  };

  beforeEach(() => serve({ baby: BABY }));

  it("parte de la edad y de los alérgenos a evitar del perfil", async () => {
    renderWithQuery(<RecipesScreen />);
    await waitFor(() => {
      expect(lastRecipeParams().age).toBe(7);
      expect(lastRecipeParams().exclude).toBe("mani");
    });
    expect(
      (await screen.findAllByText("Para un bebé de 7 meses · sin maní")).length,
    ).toBeGreaterThan(0);
  });

  it("«Borrar filtros» quita también lo que venía del perfil", async () => {
    const user = userEvent.setup();
    renderWithQuery(<RecipesScreen />);
    await waitFor(() => expect(lastRecipeParams().exclude).toBe("mani"));

    await user.click(screen.getByRole("button", { name: /Filtros/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Borrar filtros" }),
    );
    await waitFor(() => {
      expect(lastRecipeParams().exclude).toBeUndefined();
      expect(lastRecipeParams().age).toBeUndefined();
    });
  });

  it("un bebé menor de 6 meses no manda una edad inválida al API", async () => {
    serve({ baby: { ...BABY, ageMonths: 3 } });
    renderWithQuery(<RecipesScreen />);
    await screen.findByRole("link", { name: /Avena cremosa/ });
    expect(lastRecipeParams().age).toBeUndefined();
  });
});

describe("catálogo con la despensa de la familia", () => {
  const sinSalmon = {
    foods: [],
    unavailable: ["salmon"],
    recipes: { cookable: 52, total: 71 },
  };

  it("sin nada marcado como «no lo consigo» no filtra por despensa", async () => {
    serve();
    renderWithQuery(<RecipesScreen />);
    await screen.findByRole("link", { name: /Avena cremosa/ });
    expect(lastRecipeParams().cookable).toBeUndefined();
  });

  it("si la familia marcó algo, arranca mostrando solo lo que puede cocinar", async () => {
    serve({ pantry: sinSalmon });
    renderWithQuery(<RecipesScreen />);
    await waitFor(() => expect(lastRecipeParams().cookable).toBe("1"));
    expect(
      (await screen.findAllByText("con lo que consigues")).length,
    ).toBeGreaterThan(0);
  });

  it("se puede ver todo desde el Sheet de filtros", async () => {
    serve({ pantry: sinSalmon });
    const user = userEvent.setup();
    renderWithQuery(<RecipesScreen />);
    await waitFor(() => expect(lastRecipeParams().cookable).toBe("1"));

    await user.click(screen.getByRole("button", { name: /Filtros/ }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog)
        .getByRole("link", { name: "Cambiar mi despensa" })
        .getAttribute("href"),
    ).toBe("/despensa");
    await user.click(
      within(dialog).getByRole("switch", { name: "Solo lo que puedo cocinar" }),
    );
    await waitFor(() => expect(lastRecipeParams().cookable).toBeUndefined());
  });

  it("las recetas a las que les falta algo lo dicen", async () => {
    serve({
      recipes: [
        recipe({}),
        recipe({
          code: "A6",
          title: "Pasta con salmón",
          missingFoods: ["salmón"],
        }),
      ],
    });
    renderWithQuery(<RecipesScreen />);
    const link = await screen.findByRole("link", { name: /Pasta con salmón/ });
    expect(within(link).getByText("Te falta: salmón")).toBeTruthy();
    expect(
      within(screen.getByRole("link", { name: /Avena cremosa/ })).queryByText(
        /Te falta/,
      ),
    ).toBeNull();
  });
});
