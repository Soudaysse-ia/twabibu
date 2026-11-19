/** Comorian franc. Amounts are stored as integers (no cents). */
export const CURRENCY = 'KMF';

/** 5000 → `5 000 KMF` (non-breaking spaces). */
export function formatKmf(amount: number): string {
  const rounded = Math.round(amount);
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return `${rounded < 0 ? '-' : ''}${grouped}\u00A0${CURRENCY}`;
}
