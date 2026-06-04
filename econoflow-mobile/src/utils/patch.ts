import type { PatchOperation } from '../api/types';

export const buildReplace = (path: string, value: unknown): PatchOperation => ({
  op: 'replace',
  path: `/${path}`,
  value,
});

export const buildPatch = (fields: Record<string, unknown>): PatchOperation[] =>
  Object.entries(fields).map(([key, value]) => buildReplace(key, value));

export const buildExpenseItemPatch = (
  itemIndex: number,
  fields: { name: string; amount: number; date: string },
): PatchOperation[] => [
  buildReplace(`items/${itemIndex}/name`, fields.name),
  buildReplace(`items/${itemIndex}/amount`, fields.amount),
  buildReplace(`items/${itemIndex}/date`, fields.date),
];
