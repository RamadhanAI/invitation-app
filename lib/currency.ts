// lib/currency.ts
export function formatCents(amount: number, currency: string) {
    return `${currency} ${(amount / 100).toFixed(2)}`;
  }
  