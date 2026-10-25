export type FoodGuideItem = {
  food: string;
  fromAge: string; // '6 m', '6 m (cocina)', 'Con cautela', '—'
  preparation: string;
  caution: string | null;
};

export type FruitCutItem = {
  fruit: string;
  age7to8: string;
  age9to11: string;
  caution: string | null;
};
