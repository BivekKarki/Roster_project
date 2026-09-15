export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export const intParam = (v: string | string[] | undefined, fallback = 0, min = -520, max = 520) => {
  const n = Number.parseInt(one(v), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
