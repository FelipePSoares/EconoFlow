// Aurora palette — one colour per category slot (cycles if more than 6 categories)
export const CATEGORY_COLORS = [
  '#0f76a8', // teal
  '#0e9f6e', // accent green
  '#f39c12', // amber
  '#2f6df0', // indigo
  '#7b61ff', // violet
  '#e74c3c', // red
];

export const getCategoryColor = (index: number): string =>
  CATEGORY_COLORS[index % CATEGORY_COLORS.length];
