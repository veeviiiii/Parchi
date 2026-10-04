// Bills (FEATURES_V2 section 8). Plain code only: Gemma never sees prices or totals.
// All money on a bill is whole paise (₹1 = 100 paise), so totals and splits add up exactly.
import type { OrderGroup } from "./aggregate";
import { itemLabel } from "./exports";
import type { Prices } from "./money";
import type { Role } from "./roles";

export type BillLine = { item: string; quantity: number; ratePaise: number; amountPaise: number };
export type BillShare = { name: string; amountPaise: number };

export type Bill = {
  id: string; // the bill number, also used in the /bill/[id] link
  createdAt: string; // ISO time
  role: Role;
  from: string; // may be empty: the shop name is optional for consumers and communities
  to: string;
  lines: BillLine[];
  totalPaise: number;
  split: BillShare[] | null; // community bills only
};

const toPaise = (rupees: number) => Math.round(rupees * 100);

// One row per item, counting only `sender`'s entries when given (a merchant's per-customer bill).
function rowsFor(groups: OrderGroup[], sender?: string) {
  return groups.flatMap((group) => {
    const entries = sender ? group.entries.filter((entry) => entry.sender === sender) : group.entries;
    if (entries.length === 0) return [];
    return [
      {
        group,
        quantity: entries.reduce((sum, entry) => sum + (entry.quantity ?? 0), 0),
        unknown: entries.some((entry) => entry.quantity === null),
      },
    ];
  });
}

const count = (n: number, one: string, many: string) => `${n} missing ${n === 1 ? one : many}`;

// Why a bill can't be made yet, or null if it can. Rows with quantity 0 are left off the bill.
export function billProblem(groups: OrderGroup[], prices: Prices, sender?: string): string | null {
  const rows = rowsFor(groups, sender);
  const quantities = rows.filter((row) => row.unknown).length;
  const missingPrices = rows.filter((row) => row.quantity > 0 && !(row.group.key in prices)).length;
  const missing = [
    quantities > 0 && count(quantities, "quantity", "quantities"),
    missingPrices > 0 && count(missingPrices, "price", "prices"),
  ].filter(Boolean);
  if (missing.length > 0) return `Add ${missing.join(" and ")} first.`;
  if (!rows.some((row) => row.quantity > 0)) return "Nothing to bill yet.";
  return null;
}

// "PCH-YYMMDD-XXXX": the date in India, then 4 random uppercase base36 characters.
export function billNumber(now: Date, random: () => number = Math.random): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const code = Array.from({ length: 4 }, () => Math.floor(random() * 36).toString(36)).join("");
  return `PCH-${part("year")}${part("month")}${part("day")}-${code.toUpperCase()}`;
}

type BillInput = {
  groups: OrderGroup[];
  prices: Prices;
  role: Role;
  from: string;
  to: string;
  sender?: string; // merchant: bill only this customer
  now?: Date;
  random?: () => number;
};

// Call only when billProblem() returns null.
export function buildBill({ groups, prices, role, from, to, sender, now = new Date(), random }: BillInput): Bill {
  const rows = rowsFor(groups, sender).filter((row) => row.quantity > 0);
  const lines = rows.map(({ group, quantity }) => {
    const ratePaise = toPaise(prices[group.key] ?? 0);
    return { item: itemLabel(group.name, group.variant), quantity, ratePaise, amountPaise: quantity * ratePaise };
  });

  // Community split: each person pays for their own quantities, in whole paise,
  // so the shares add up to exactly the same total as the lines.
  let split: BillShare[] | null = null;
  if (role === "community") {
    const owed = new Map<string, number>();
    for (const { group } of rows) {
      const ratePaise = toPaise(prices[group.key] ?? 0);
      for (const entry of group.entries) {
        if (!entry.quantity) continue;
        owed.set(entry.sender, (owed.get(entry.sender) ?? 0) + entry.quantity * ratePaise);
      }
    }
    split = [...owed].map(([name, amountPaise]) => ({ name, amountPaise }));
  }

  return {
    id: billNumber(now, random),
    createdAt: now.toISOString(),
    role,
    from: from.trim(),
    to: to.trim(),
    lines,
    totalPaise: lines.reduce((sum, line) => sum + line.amountPaise, 0),
    split,
  };
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

// 0–99 → "Thirty-Four"
function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
}

// Indian system: crore (1,00,00,000), lakh (1,00,000), thousand, hundred.
function numberWords(n: number): string {
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  if (crore) parts.push(`${numberWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(belowHundred(rest));
  return parts.join(" ");
}

// 1234567.89 → "Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Eighty-Nine Paise Only"
export function amountInWords(rupees: number): string {
  const paise = toPaise(rupees);
  const whole = Math.floor(paise / 100);
  const cents = paise % 100;
  const words = `Rupees ${whole === 0 ? "Zero" : numberWords(whole)}`;
  return cents ? `${words} and ${belowHundred(cents)} Paise Only` : `${words} Only`;
}

// Plain numbers for the Rate and Amount columns: 123456 paise → "1,234.56"
export function formatAmount(paise: number): string {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paise / 100);
}

// "4 Oct 2026, 1:30 am", always in Indian time.
export function formatBillDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export const BILL_FOOTER = ["Generated with Parchi · Parchi for everyone", "This is not a GST tax invoice."];

// The bill as plain text, for pasting into WhatsApp.
export function billText(bill: Bill): string {
  const rupees = (paise: number) => `₹${formatAmount(paise)}`;
  return [
    `Parchi bill ${bill.id}`,
    formatBillDate(bill.createdAt),
    ...(bill.from ? [`From: ${bill.from}`] : []),
    `To: ${bill.to}`,
    "",
    ...bill.lines.map(
      (line, i) => `${i + 1}. ${line.item} × ${line.quantity} @ ${rupees(line.ratePaise)} = ${rupees(line.amountPaise)}`,
    ),
    "",
    `Total: ${rupees(bill.totalPaise)}`,
    amountInWords(bill.totalPaise / 100),
    ...(bill.split ? ["", "Split", ...bill.split.map((share) => `${share.name}: ${rupees(share.amountPaise)}`)] : []),
    "",
    ...BILL_FOOTER,
  ].join("\n");
}
