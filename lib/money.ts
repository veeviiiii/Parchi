// Prices, totals, and who owes what (CLAUDE.md section 11). Plain code only:
// Gemma never sees prices. The organiser types every one.
import type { OrderGroup } from "./aggregate";

// Unit price in rupees, by order-sheet row (group key).
export type Prices = Record<string, number>;

// "12.5" → 12.5. Empty, negative, or not a number → null.
export function parsePrice(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const price = Number(trimmed);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

// What the organiser typed in each price box → the prices we can use.
export function parsePrices(texts: Record<string, string>): Prices {
  const prices: Prices = {};
  for (const [key, text] of Object.entries(texts)) {
    const price = parsePrice(text);
    if (price !== null) prices[key] = price;
  }
  return prices;
}

// Total quantity × unit price. A row with no price counts as ₹0 for now.
export function lineTotal(group: OrderGroup, prices: Prices): number {
  return group.totalQuantity * (prices[group.key] ?? 0);
}

export function grandTotal(groups: OrderGroup[], prices: Prices): number {
  return groups.reduce((sum, group) => sum + lineTotal(group, prices), 0);
}

// Each person pays for their own quantity of each item.
// Unknown quantities count for nothing until the organiser fixes them.
export function whoOwes(groups: OrderGroup[], prices: Prices): { sender: string; amount: number }[] {
  const owed = new Map<string, number>();
  for (const group of groups) {
    for (const entry of group.entries) {
      const amount = (entry.quantity ?? 0) * (prices[group.key] ?? 0);
      owed.set(entry.sender, (owed.get(entry.sender) ?? 0) + amount);
    }
  }
  return [...owed].map(([sender, amount]) => ({ sender, amount }));
}

// 230 → "₹230", 1234.5 → "₹1,234.50", 123456 → "₹1,23,456"
export function formatRupees(amount: number): string {
  const paise = Math.round(amount * 100);
  const digits = paise % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(paise / 100);
}
