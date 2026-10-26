// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Menu, MenuMeal } from "@/modules/menu/menu.schemas";
import { renderWithQuery } from "@/test/render";
import { MenuScreen } from "./menu-screen";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
const toast = vi.hoisted(() => {
  const t = vi.fn() as ReturnType<typeof vi.fn> & {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  t.success = vi.fn();
  t.error = vi.fn();
  return t;
});
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api,
}));
vi.mock("sonner", () => ({ toast }));

const MEALS: MenuMeal[] = ["desayuno", "almuerzo", "merienda"];
const menuWith = (ageMonths: number, tag = "v1"): Menu => ({
  weekStart: "2026-10-26",
  today: 3,
  ageMonths,
  days: [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    day,
    meals: MEALS.map((meal) => ({
      meal,
      recipe: {
        code: `${meal[0]!.toUpperCase()}${day}`,
        title: `${meal} del día ${day} ${tag}`,
        mealType: meal,
        minAgeMonths: 7,
        isIronSource: meal === "almuerzo",
        ironNote: null,
        thumbUrl: null,
        allergens: [],
      },
    })),
  })),
  checks: [
    {
      key: "iron",
      ok: true,
      title: "Hierro",
      detail: "Todos los días tienen 2 comidas o más con hierro.",
      short: "2 o más al día",
    },
    {
      key: "fish",
      ok: false,
      title: "Pescado",
      detail: "1 vez esta semana. Lo recomendado son unas 2.",
      short: "1 vez",
    },
    {
      key: "liver",
      ok: true,
      title: "Hígado",
      detail: "0 veces. Máximo 1 vez por semana.",
      short: "0 de 1 máx.",
    },
  ],
});
const BABY = (ageMonths: number) => ({
  birthMonth: 3,
  birthYear: 2026,
  ageMonths,
  allergens: {},
});

function serve(baby: ReturnType<typeof BABY> | null, menu: Menu | null) {
  api.get.mockImplementation(async (url: string) =>
    url === "/baby" ? { data: { baby } } : { data: { menu } },
  );
}
// Consultas dentro de la vista por día; findByText espera a que cargue el contenedor.
type Matcher = string | RegExp;
const dayView = {
  getByText: (m: Matcher) =>
    within(screen.getByTestId("day-view")).getByText(m),
  getByRole: (role: string, o?: { name?: Matcher }) =>
    within(screen.getByTestId("day-view")).getByRole(role, o),
  findByText: async (m: Matcher) =>
    within(await screen.findByTestId("day-view")).findByText(m),
};

beforeEach(() => {
  for (const fn of [
    api.get,
    api.post,
    api.put,
    toast,
    toast.success,
    toast.error,
  ])
    fn.mockReset();
});

describe("menú semanal", () => {
  it("sin perfil del bebé pide la fecha de nacimiento", async () => {
    serve(null, null);
    renderWithQuery(<MenuScreen />);
    expect(
      await screen.findByText("Primero cuéntanos de tu bebé"),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Indicar fecha de nacimiento" })
        .getAttribute("href"),
    ).toBe("/bebe");
  });

  it("primera vez: invita a generar y muestra el menú al terminar", async () => {
    serve(BABY(7), null);
    api.post.mockResolvedValue({ data: { menu: menuWith(7) } });
    const user = userEvent.setup();
    renderWithQuery(<MenuScreen />);

    expect(
      await screen.findByText("Todavía no hay menú para esta semana"),
    ).toBeTruthy();
    expect(screen.getByText(/recetas para un bebé de 7 meses/)).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Generar menú de la semana" }),
    );

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/menu/generate"),
    );
    expect(await dayView.findByText("Miércoles 28 de octubre")).toBeTruthy(); // hoy
    expect(dayView.getByText("desayuno del día 3 v1")).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith("Menú listo", expect.anything());
  });

  it("muestra el día de hoy, cambia de día y avisa que la cena llega a los 8 meses", async () => {
    serve(BABY(7), menuWith(7));
    const user = userEvent.setup();
    renderWithQuery(<MenuScreen />);

    expect(await dayView.findByText("desayuno del día 3 v1")).toBeTruthy();
    expect(dayView.getByText("La cena aparece desde los 8 meses")).toBeTruthy();
    expect(dayView.getByText(/por ahora son 3 comidas al día/)).toBeTruthy();

    await user.click(
      dayView.getByRole("tab", { name: /Viernes 30 de octubre/ }),
    );
    expect(await dayView.findByText("Viernes 30 de octubre")).toBeTruthy();
    expect(dayView.getByText("almuerzo del día 5 v1")).toBeTruthy();
  });

  it("el resumen de la semana dice lo que se cumple y lo que no", async () => {
    serve(BABY(7), menuWith(7));
    renderWithQuery(<MenuScreen />);
    await screen.findByTestId("day-view");
    expect(
      screen.getAllByText("Todos los días tienen 2 comidas o más con hierro.")
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("1 vez esta semana. Lo recomendado son unas 2.")
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Hay cosas por revisar")).toBeTruthy();
  });

  it("cambiar una comida actualiza el menú y permite deshacer", async () => {
    serve(BABY(7), menuWith(7));
    const previous = [{ day: 3, meal: "desayuno" as const, recipe: "D3" }];
    api.post.mockResolvedValue({ data: { menu: menuWith(7, "v2"), previous } });
    api.put.mockResolvedValue({ data: { menu: menuWith(7) } });
    const user = userEvent.setup();
    renderWithQuery(<MenuScreen />);
    await dayView.findByText("desayuno del día 3 v1");

    await user.click(
      dayView.getByRole("button", { name: "Cambiar desayuno del miércoles" }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/menu/regenerate", {
        scope: "meal",
        day: 3,
        meal: "desayuno",
      }),
    );
    expect(await dayView.findByText("desayuno del día 3 v2")).toBeTruthy();

    const [message, options] = toast.success.mock.calls.at(-1)!;
    expect(message).toBe("Cambiamos el desayuno del miércoles");
    options.action.onClick();
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/menu/entries", {
        entries: previous,
      }),
    );
    expect(await dayView.findByText("desayuno del día 3 v1")).toBeTruthy();
  });

  it("si no hay otra opción lo dice y no ofrece deshacer", async () => {
    serve(BABY(7), menuWith(7));
    api.post.mockResolvedValue({ data: { menu: menuWith(7), previous: [] } });
    const user = userEvent.setup();
    renderWithQuery(<MenuScreen />);
    await dayView.findByText("desayuno del día 3 v1");

    await user.click(
      dayView.getByRole("button", { name: "Cambiar merienda del miércoles" }),
    );
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith("No hay otra opción para esto"),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("cambiar el día completo", async () => {
    serve(BABY(7), menuWith(7));
    api.post.mockResolvedValue({
      data: {
        menu: menuWith(7),
        previous: [{ day: 3, meal: "almuerzo", recipe: "A3" }],
      },
    });
    const user = userEvent.setup();
    renderWithQuery(<MenuScreen />);
    await dayView.findByText("desayuno del día 3 v1");

    await user.click(dayView.getByRole("button", { name: "Cambiar este día" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/menu/regenerate", {
        scope: "day",
        day: 3,
      }),
    );
    await waitFor(() =>
      expect(toast.success.mock.calls.at(-1)![0]).toBe(
        "Cambiamos las comidas del miércoles",
      ),
    );
  });

  it("generar de nuevo pide confirmación antes de reemplazar el menú", async () => {
    serve(BABY(7), menuWith(7));
    api.post.mockResolvedValue({ data: { menu: menuWith(7, "nuevo") } });
    const user = userEvent.setup();
    renderWithQuery(<MenuScreen />);
    await dayView.findByText("desayuno del día 3 v1");

    await user.click(
      dayView.getByRole("button", { name: "Generar menú de la semana" }),
    );
    expect(await screen.findByText("¿Generar un menú nuevo?")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Generar menú nuevo" }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/menu/generate"),
    );
    expect(await dayView.findByText("desayuno del día 3 nuevo")).toBeTruthy();
  });

  it("un error de generación explica qué pasó y permite reintentar", async () => {
    serve(BABY(7), null);
    const { ApiError } = await import("@/lib/api-client");
    api.post.mockRejectedValueOnce(
      new ApiError(
        422,
        "not_enough_recipes",
        "Todavía no hay recetas suficientes para esa edad y esos alérgenos",
      ),
    );
    const user = userEvent.setup();
    renderWithQuery(<MenuScreen />);
    await user.click(
      await screen.findByRole("button", { name: "Generar menú de la semana" }),
    );

    expect(await screen.findByText("No pudimos generar el menú")).toBeTruthy();
    expect(screen.getByText(/Todavía no hay recetas suficientes/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Intentar de nuevo/ }),
    ).toBeTruthy();
  });
});

describe("menú con un alérgeno que ahora se evita", () => {
  // El perfil cambió después de generar el menú: el almuerzo del miércoles lleva maní.
  const withMani = (): Menu => {
    const menu = menuWith(7);
    const lunch = menu.days[2]!.meals.find((m) => m.meal === "almuerzo")!;
    lunch.recipe.allergens = [
      { slug: "mani", name: "Maní", isOptional: false, condition: null },
    ];
    return menu;
  };
  const babyAvoiding = (slugs: string[]) => ({
    birthMonth: 3,
    birthYear: 2026,
    ageMonths: 7,
    allergens: Object.fromEntries(slugs.map((s) => [s, "avoid"])),
  });

  it("avisa, marca la receta en rojo y ofrece generar de nuevo", async () => {
    serve(babyAvoiding(["mani"]), withMani());
    api.post.mockResolvedValue({ data: { menu: menuWith(7, "limpio") } });
    const user = userEvent.setup();
    renderWithQuery(<MenuScreen />);

    expect(
      await screen.findByText("Este menú tiene recetas con el maní"),
    ).toBeTruthy();
    expect(screen.getByText(/sigue en 1 comida de este menú/)).toBeTruthy();
    expect(dayView.getByText("Maní · evitar")).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "Generar menú nuevo" }),
    );
    // con el diálogo abierto, el resto de la página queda oculto: solo hay un botón accesible con ese nombre
    await user.click(
      await screen.findByRole("button", { name: "Generar menú nuevo" }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/menu/generate"),
    );
    await waitFor(() =>
      expect(screen.queryByText(/Este menú tiene recetas con/)).toBeNull(),
    );
  });

  it("sin alérgenos a evitar (o si ya lo come) no hay aviso", async () => {
    serve(babyAvoiding([]), withMani());
    const { unmount } = renderWithQuery(<MenuScreen />);
    await dayView.findByText("desayuno del día 3 v1");
    expect(screen.queryByText(/Este menú tiene recetas con/)).toBeNull();
    expect(screen.queryByText("Maní · evitar")).toBeNull();
    unmount();

    serve(
      { ...babyAvoiding([]), allergens: { mani: "introduced" } },
      withMani(),
    );
    renderWithQuery(<MenuScreen />);
    await dayView.findByText("desayuno del día 3 v1");
    expect(screen.queryByText(/Este menú tiene recetas con/)).toBeNull();
  });
});
