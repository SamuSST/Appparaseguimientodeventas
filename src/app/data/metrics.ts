export function percentageOf(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return (value / total) * 100;
}

export function percentageLabel(value: number): string {
  return `${Math.round(Number.isFinite(value) ? value : 0)}%`;
}

export function percentageWidth(value: number): number {
  return Math.max(0, Math.min(Number.isFinite(value) ? value : 0, 100));
}

export function roundedShares(values: number[]): number[] {
  const nonNegativeValues = values.map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0));
  const total = nonNegativeValues.reduce((sum, value) => sum + value, 0);
  if (total === 0) return values.map(() => 0);

  const exactShares = nonNegativeValues.map((value) => (value / total) * 100);
  const shares = exactShares.map(Math.floor);
  let remaining = 100 - shares.reduce((sum, share) => sum + share, 0);
  const remainderOrder = exactShares
    .map((share, index) => ({ index, remainder: share - shares[index] }))
    .sort((a, b) => b.remainder - a.remainder);

  for (let index = 0; index < remaining; index += 1) {
    shares[remainderOrder[index % remainderOrder.length].index] += 1;
  }

  return shares;
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
