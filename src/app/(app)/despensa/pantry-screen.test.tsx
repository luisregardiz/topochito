// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PantryState } from "@/modules/pantry/pantry.schemas";
import { renderWithQuery } from "@/test/render";
import { PantryScreen } from "./pantry-screen";

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api,
}));
vi.mock("sonner", () => ({ toast }));

const STATE: PantryState = {
  foods: [
    { slug: "pollo", name: "Pollo", category: "proteinas" },
    { slug: "salmon", name: "Salmón", category: "proteinas" },
    {
      slug: "queso-fresco",
      name: "Queso fresco bajo en sal",
      category: "lacteos",
    },
    { slug: "quinoa", name: "Quinoa", category: "cereales" },
  ],
  unavailable: ["quinoa"],
  recipes: { cookable: 60, total: 71 },
};

beforeEach(() => {
  for (const fn of [api.get, api.put, toast.success]) fn.mockReset();
  api.get.mockResolvedValue({ data: STATE });
});

const box = (name: string) => screen.getByRole("checkbox", { name });

describe("mi despensa", () => {
  it("lista los alimentos por categoría con lo marcado como no disponible", async () => {
    renderWithQuery(<PantryScreen />);
    expect(await screen.findByText("Consigues 3 de 4 alimentos")).toBeTruthy();
    expect(screen.getByText(/puedes cocinar 60 de 71 recetas/)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Carnes, pescados y huevos" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Lácteos" })).toBeTruthy();
    expect(box("Pollo").getAttribute("aria-checked")).toBe("true");
    expect(box("Quinoa").getAttribute("aria-checked")).toBe("false");
    expect(
      screen.getByText(
        /El agua, el aceite y las hierbas y especias no se preguntan/,
      ),
    ).toBeTruthy();
  });

  it("desmarca un alimento y guarda solo lo que no consigue", async () => {
    api.put.mockResolvedValue({
      data: {
        ...STATE,
        unavailable: ["quinoa", "salmon"],
        recipes: { cookable: 50, total: 71 },
      },
    });
    const user = userEvent.setup();
    renderWithQuery(<PantryScreen />);
    await screen.findByText("Consigues 3 de 4 alimentos");

    await user.click(box("Salmón"));
    expect(await screen.findByText("Consigues 2 de 4 alimentos")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/pantry", {
        unavailable: expect.arrayContaining(["quinoa", "salmon"]),
      }),
    );
    expect(api.put.mock.calls[0]![1].unavailable).toHaveLength(2);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Guardamos tu despensa", {
        description: "Puedes cocinar 50 de 71 recetas.",
      }),
    );
  });

  it("marcar o desmarcar todos los de una categoría", async () => {
    const user = userEvent.setup();
    renderWithQuery(<PantryScreen />);
    await screen.findByText("Consigues 3 de 4 alimentos");

    // «Cereales»: quinoa estaba desmarcada → «Marcar todos» la vuelve a marcar
    await user.click(
      screen.getByRole("button", {
        name: "Marcar todos: Cereales, harinas y pan",
      }),
    );
    expect(await screen.findByText("Consigues 4 de 4 alimentos")).toBeTruthy();
    // ahora todo está marcado → el botón pasa a «Desmarcar todos»
    await user.click(
      screen.getByRole("button", {
        name: "Desmarcar todos: Cereales, harinas y pan",
      }),
    );
    expect(await screen.findByText("Consigues 3 de 4 alimentos")).toBeTruthy();
  });

  it("busca sin tildes y avisa cuando no hay coincidencias", async () => {
    const user = userEvent.setup();
    renderWithQuery(<PantryScreen />);
    await screen.findByText("Consigues 3 de 4 alimentos");

    await user.type(screen.getByRole("searchbox"), "salmon");
    expect(screen.getByRole("checkbox", { name: "Salmón" })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Pollo" })).toBeNull();

    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "pizza");
    expect(await screen.findByText("No encontramos «pizza»")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
    expect(await screen.findByRole("checkbox", { name: "Pollo" })).toBeTruthy();
  });

  it("si falla al guardar, mantiene los cambios y permite reintentar", async () => {
    const { ApiError } = await import("@/lib/api-client");
    api.put.mockRejectedValueOnce(
      new ApiError(0, "network_error", "Network Error"),
    );
    const user = userEvent.setup();
    renderWithQuery(<PantryScreen />);
    await screen.findByText("Consigues 3 de 4 alimentos");

    await user.click(box("Pollo"));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("No pudimos guardar")).toBeTruthy();
    expect(screen.getByText("Consigues 2 de 4 alimentos")).toBeTruthy(); // los cambios siguen en pantalla

    api.put.mockResolvedValue({ data: STATE });
    await user.click(screen.getByRole("button", { name: /Intentar de nuevo/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("si no carga, ofrece reintentar", async () => {
    api.get.mockRejectedValue(new Error("red"));
    renderWithQuery(<PantryScreen />);
    expect(
      await screen.findByText(
        "No se pudo cargar tu despensa",
        {},
        { timeout: 4000 },
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("alert")).getByRole("button", {
        name: "Reintentar",
      }),
    ).toBeTruthy();
  });
});
