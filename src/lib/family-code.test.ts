import { describe, expect, it } from "vitest";
import {
  formatFamilyCode,
  isFamilyCodeComplete,
  nextFamilyCode,
} from "./family-code";

describe("formatFamilyCode", () => {
  it("pone el guion al llegar al 5.º carácter", () => {
    expect(formatFamilyCode("K7QM")).toBe("K7QM");
    expect(formatFamilyCode("K7QM2")).toBe("K7QM-2");
  });

  it("limpia lo pegado: minúsculas, espacios y guiones", () => {
    expect(formatFamilyCode("k7qm2rxp")).toBe("K7QM-2RXP");
    expect(formatFamilyCode("K7QM 2RXP")).toBe("K7QM-2RXP");
    expect(formatFamilyCode(" k7qm-2rxp ")).toBe("K7QM-2RXP");
  });

  it("solo letras y números, máximo 8", () => {
    expect(formatFamilyCode("K7!Q@M#2$RXPZZ")).toBe("K7QM-2RXP");
  });
});

describe("nextFamilyCode", () => {
  it("borrar el guion también borra el carácter anterior", () => {
    expect(
      nextFamilyCode("K7QM-2RXP", "K7QM2RXP", "deleteContentBackward"),
    ).toBe("K7Q2-RXP");
  });

  it("borrar un carácter normal funciona", () => {
    expect(nextFamilyCode("K7QM-2", "K7QM-", "deleteContentBackward")).toBe(
      "K7QM",
    );
    expect(nextFamilyCode("K7QM", "K7Q", "deleteContentBackward")).toBe("K7Q");
  });

  it("escribir formatea", () => {
    expect(nextFamilyCode("K7QM", "K7QM2", "insertText")).toBe("K7QM-2");
  });
});

describe("isFamilyCodeComplete", () => {
  it("exige 8 caracteres", () => {
    expect(isFamilyCodeComplete("K7QM-2RX")).toBe(false);
    expect(isFamilyCodeComplete("K7QM-2RXP")).toBe(true);
  });
});
