/** Escape string literals for Airtable `filterByFormula`. */
export function airtableFormulaString(value: string): string {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
