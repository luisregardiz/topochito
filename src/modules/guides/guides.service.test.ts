import { describe, expect, it } from "vitest";
import { listFruitCuts } from "./guides.service";

describe("listFruitCuts", () => {
  it("expone age_7_8 y age_9_11 como age7to8 y age9to11", async () => {
    const repo = {
      fruits: async () => [
        {
          fruit: "Aguacate",
          age78: "Gajo grueso",
          age911: "Dados",
          caution: null,
        },
      ],
    };
    expect(await listFruitCuts(repo)).toEqual([
      {
        fruit: "Aguacate",
        age7to8: "Gajo grueso",
        age9to11: "Dados",
        caution: null,
      },
    ]);
  });
});
