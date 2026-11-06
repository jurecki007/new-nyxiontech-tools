// Plural forms, kept apart from index.ts so dictionaries can import them.

/**
 * Polish-style plural: picks the form for 1, for 2-4 (but not 12-14) and for the rest.
 * "1 plik", "3 pliki", "5 plików", "22 pliki".
 */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const tens = n % 100;
  const units = n % 10;
  return units >= 2 && units <= 4 && !(tens >= 12 && tens <= 14) ? few : many;
}
