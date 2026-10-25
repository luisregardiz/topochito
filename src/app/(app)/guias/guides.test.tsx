// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/test/render";
import { FoodGuideScreen } from "./despensa/food-guide";
import { FruitGuideScreen } from "./frutas/fruit-guide";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { get },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

const FOOD = [
  {
    food: "Harina de maíz precocida",
    fromAge: "6 m",
    preparation: "Arepitas finas y blandas.",
    caution: null,
  },
  {
    food: "Queso blanco duro",
    fromAge: "Con cautela",
    preparation: "Mejor ricota.",
    caution: "Mucha sal",
  },
  {
    food: "Papelón, azúcar, miel, melaza",
    fromAge: "—",
    preparation: "No.",
    caution: "Miel nunca antes de 1 año.",
  },
];

beforeEach(() => get.mockReset());

describe("guía de la despensa", () => {
  beforeEach(() => get.mockResolvedValue({ data: { items: FOOD } }));

  it("muestra la edad como insignia y la precaución como aviso", async () => {
    renderWithQuery(<FoodGuideScreen />);
    expect(await screen.findByText("Harina de maíz precocida")).toBeTruthy();
    expect(screen.getByText("Desde 6 m")).toBeTruthy();
    expect(screen.getByText("Con cautela")).toBeTruthy();
    expect(screen.getByText("No recomendado")).toBeTruthy();
    expect(screen.getByText("Miel nunca antes de 1 año.")).toBeTruthy();
    expect(
      screen.getByText("3 alimentos: desde qué edad y cómo prepararlos."),
    ).toBeTruthy();
  });

  it("busca sin tildes y sin distinguir mayúsculas", async () => {
    const user = userEvent.setup();
    renderWithQuery(<FoodGuideScreen />);
    await screen.findByText("Harina de maíz precocida");

    await user.type(screen.getByRole("searchbox"), "MAIZ");
    expect(screen.getByText("Harina de maíz precocida")).toBeTruthy();
    expect(screen.queryByText("Queso blanco duro")).toBeNull();
  });

  it("sin coincidencias sugiere otra palabra y permite borrar", async () => {
    const user = userEvent.setup();
    renderWithQuery(<FoodGuideScreen />);
    await screen.findByText("Harina de maíz precocida");

    await user.type(screen.getByRole("searchbox"), "pizza");
    expect(
      await screen.findByText("No encontramos «pizza» en la despensa"),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
    expect(await screen.findByText("Queso blanco duro")).toBeTruthy();
  });
});

describe("cortes de fruta", () => {
  it("muestra los dos tramos y la precaución", async () => {
    get.mockResolvedValue({
      data: {
        items: [
          {
            fruit: "Uvas, cerezas",
            age7to8: "Aplastadas",
            age9to11: "En cuartos a lo largo",
            caution: "Nunca enteras",
          },
        ],
      },
    });
    renderWithQuery(<FruitGuideScreen />);
    expect(await screen.findByText("Uvas, cerezas")).toBeTruthy();
    expect(screen.getByText("Nunca enteras")).toBeTruthy();
    expect(screen.getByText("Aplastadas")).toBeTruthy();
    expect(screen.getByText("En cuartos a lo largo")).toBeTruthy();
    expect(screen.getByText("7–8 meses")).toBeTruthy();
    expect(screen.getByText("9–11 meses")).toBeTruthy();
  });
});

describe("cortes de fruta con el perfil del bebé", () => {
  const FRUITS = {
    items: [
      {
        fruit: "Aguacate",
        age7to8: "Gajo grueso",
        age9to11: "Dados",
        caution: null,
      },
    ],
  };
  const serve = (ageMonths: number | null) =>
    get.mockImplementation(async (url: string) =>
      url === "/baby"
        ? {
            data: {
              baby:
                ageMonths === null
                  ? null
                  : {
                      birthMonth: 1,
                      birthYear: 2026,
                      ageMonths,
                      allergens: {},
                    },
            },
          }
        : { data: FRUITS },
    );

  it("resalta el tramo del bebé", async () => {
    serve(9);
    renderWithQuery(<FruitGuideScreen />);
    const marker = await screen.findByText("Tu bebé");
    expect(marker.closest("div")!.textContent).toContain("9–11 meses");
    expect(screen.getAllByText("Tu bebé")).toHaveLength(1);
  });

  it("sin perfil o fuera de esos tramos no resalta nada", async () => {
    serve(null);
    const { unmount } = renderWithQuery(<FruitGuideScreen />);
    await screen.findByText("Aguacate");
    expect(screen.queryByText("Tu bebé")).toBeNull();
    unmount();

    serve(14);
    renderWithQuery(<FruitGuideScreen />);
    await screen.findByText("Aguacate");
    expect(screen.queryByText("Tu bebé")).toBeNull();
  });
});
