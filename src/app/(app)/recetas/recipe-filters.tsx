"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  activeFilterCount,
  type RecipeFilters,
} from "@/modules/recipes/recipes.queries";
import type { AllergenOption } from "@/modules/recipes/recipes.schemas";

const AGE_ITEMS = [
  { value: "any", label: "Cualquier edad" },
  ...[6, 7, 8, 9, 10, 11].map((m) => ({
    value: String(m),
    label: `${m} meses`,
  })),
  { value: "12", label: "12 meses o más" },
];

// Solo estas etiquetas se ofrecen como filtro (las demás son demasiado específicas).
const TAG_CHIPS = [
  { slug: "se-congela", label: "Se congela" },
  { slug: "sin-sal", label: "Sin sal" },
  { slug: "vitamina-c", label: "Vitamina C" },
  { slug: "vitamina-a", label: "Vitamina A" },
];

export function RecipeFilters({
  value,
  onChange,
  allergens,
  onClear,
  onApply,
}: {
  value: RecipeFilters;
  onChange: (patch: Partial<RecipeFilters>) => void;
  allergens: AllergenOption[];
  onClear: () => void;
  onApply?: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="edad" className="text-base font-bold">
          Edad del bebé
        </Label>
        <Select
          items={AGE_ITEMS}
          value={value.age === null ? "any" : String(value.age)}
          onValueChange={(v) =>
            onChange({ age: v === null || v === "any" ? null : Number(v) })
          }
        >
          <SelectTrigger id="edad" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGE_ITEMS.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-bold">
          No mostrar recetas con
        </legend>
        <ToggleGroup
          multiple
          variant="outline"
          className="flex-wrap"
          value={value.exclude}
          onValueChange={(exclude) => onChange({ exclude })}
        >
          {allergens.map((a) => (
            <ToggleGroupItem
              key={a.slug}
              value={a.slug}
              className="aria-pressed:border-destructive aria-pressed:bg-accent aria-pressed:text-destructive aria-pressed:line-through"
            >
              {value.exclude.includes(a.slug) && <X aria-hidden />}
              {a.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      <div className="flex min-h-14 items-center justify-between gap-4">
        <Label htmlFor="hierro" className="text-lg xl:text-base">
          Solo fuente de hierro
        </Label>
        <Switch
          id="hierro"
          checked={value.iron}
          onCheckedChange={(iron) => onChange({ iron })}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-bold">Etiquetas</legend>
        <ToggleGroup
          multiple
          variant="outline"
          className="flex-wrap"
          value={value.tags}
          onValueChange={(tags) => onChange({ tags })}
        >
          {TAG_CHIPS.map((t) => (
            <ToggleGroupItem
              key={t.slug}
              value={t.slug}
              className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              {value.tags.includes(t.slug) && <Check aria-hidden />}
              {t.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      <div className="flex flex-col gap-2">
        {onApply && (
          <Button size="lg" className="w-full" onClick={onApply}>
            Ver recetas
          </Button>
        )}
        <Button
          variant="ghost"
          className="w-full"
          disabled={activeFilterCount(value) === 0}
          onClick={onClear}
        >
          Borrar filtros
        </Button>
      </div>
    </div>
  );
}
