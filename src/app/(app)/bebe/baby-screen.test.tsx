// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BabyProfile } from "@/modules/babies/baby.schemas";
import { renderWithQuery } from "@/test/render";
import { BabyScreen } from "./baby-screen";

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api,
}));
vi.mock("sonner", () => ({ toast }));

const ALLERGENS = [
  { slug: "huevo", name: "Huevo" },
  { slug: "mani", name: "Maní" },
  { slug: "lacteos", name: "Lácteos" },
];
const BABY: BabyProfile = {
  nickname: null,
  birthMonth: 3,
  birthYear: 2026,
  ageMonths: 7,
  allergens: { huevo: "introduced" },
};

function serve(baby: BabyProfile | null) {
  api.get.mockImplementation(async (url: string) =>
    url === "/baby" ? { data: { baby } } : { data: { allergens: ALLERGENS } },
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T16:00:00Z"));
  api.get.mockReset();
  api.put.mockReset();
  toast.success.mockReset();
});
afterEach(() => vi.useRealTimers());

const row = (name: string) =>
  screen.getByText(name).closest("li") as HTMLElement;

describe("perfil del bebé", () => {
  it("con perfil guardado muestra la edad y el estado de cada alérgeno", async () => {
    serve(BABY);
    renderWithQuery(<BabyScreen />);
    expect(await screen.findByText("7 meses")).toBeTruthy();
    const huevo = within(row("Huevo"));
    expect(
      huevo
        .getByRole("button", { name: /Ya lo come/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    const mani = within(row("Maní"));
    expect(
      mani
        .getByRole("button", { name: "No introducido" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.queryByText(/mostramos todas las recetas/)).toBeNull();
  });

  it("marca «Evitar» y guarda con el formato del API", async () => {
    serve(BABY);
    api.put.mockResolvedValue({
      data: {
        baby: { ...BABY, allergens: { huevo: "introduced", mani: "avoid" } },
      },
    });
    const user = userEvent.setup();
    renderWithQuery(<BabyScreen />);
    await screen.findByText("7 meses");

    await user.click(
      within(row("Maní")).getByRole("button", { name: "Evitar" }),
    );
    expect(
      within(row("Maní"))
        .getByRole("button", { name: "Evitar" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/baby", {
        birthMonth: 3,
        birthYear: 2026,
        allergens: { huevo: "introduced", mani: "avoid" },
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Guardamos los datos del bebé",
        {
          description: "El menú y las recetas ya usan 7 meses.",
        },
      ),
    );
  });

  it("volver a «No introducido» quita el alérgeno del envío", async () => {
    serve({ ...BABY, allergens: { mani: "avoid" } });
    api.put.mockResolvedValue({ data: { baby: BABY } });
    const user = userEvent.setup();
    renderWithQuery(<BabyScreen />);
    await screen.findByText("7 meses");

    await user.click(
      within(row("Maní")).getByRole("button", { name: "No introducido" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        "/baby",
        expect.objectContaining({ allergens: {} }),
      ),
    );
  });

  it("sin perfil avisa y no guarda sin fecha", async () => {
    serve(null);
    const user = userEvent.setup();
    renderWithQuery(<BabyScreen />);
    expect(await screen.findByText(/mostramos todas las recetas/)).toBeTruthy();
    expect(screen.getByText("Aquí verás la edad de tu bebé.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Elige el mes y el año.")).toBeTruthy();
    expect(api.put).not.toHaveBeenCalled();
  });

  it("elige mes y año y calcula la edad al momento", async () => {
    serve(null);
    const user = userEvent.setup();
    renderWithQuery(<BabyScreen />);
    await screen.findByText(/mostramos todas las recetas/);

    await user.click(screen.getByRole("combobox", { name: "Mes" }));
    await user.click(await screen.findByRole("option", { name: "Marzo" }));
    await user.click(screen.getByRole("combobox", { name: "Año" }));
    await user.click(await screen.findByRole("option", { name: "2026" }));

    expect(await screen.findByText("7 meses")).toBeTruthy();
  });

  it("muestra el error del servidor y permite reintentar", async () => {
    serve(BABY);
    const { ApiError } = await import("@/lib/api-client");
    api.put.mockRejectedValueOnce(
      new ApiError(0, "network_error", "Network Error"),
    );
    const user = userEvent.setup();
    renderWithQuery(<BabyScreen />);
    await screen.findByText("7 meses");

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("No pudimos guardar")).toBeTruthy();
    expect(screen.getByText(/Tus cambios siguen en pantalla/)).toBeTruthy();

    api.put.mockResolvedValue({ data: { baby: BABY } });
    await user.click(screen.getByRole("button", { name: /Intentar de nuevo/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});
