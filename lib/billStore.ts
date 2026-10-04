// Saved bills, in this browser only (localStorage "parchi.bills", latest 20).
import { useMemo, useSyncExternalStore } from "react";
import type { Bill } from "./bill";

const KEY = "parchi.bills";
const KEEP = 20;

function parse(raw: string | null): Bill[] {
  try {
    const saved = JSON.parse(raw ?? "[]");
    return Array.isArray(saved) ? saved.filter((bill) => bill && typeof bill.id === "string") : [];
  } catch {
    return []; // broken JSON counts as "no bills"
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// Newest first. Returns false if the browser wouldn't save it (e.g. storage full).
export function saveBill(bill: Bill): boolean {
  const bills = [bill, ...parse(readRaw()).filter((saved) => saved.id !== bill.id)].slice(0, KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(bills));
    return true;
  } catch {
    return false;
  }
}

const subscribe = () => () => {}; // bills only change from this tab, before navigating

// `ready` is false during the first server render, before the browser has been checked.
export function useBill(id: string): { bill: Bill | null; ready: boolean } {
  const raw = useSyncExternalStore(subscribe, readRaw, () => undefined);
  return useMemo(
    () => ({ bill: raw === undefined ? null : (parse(raw).find((bill) => bill.id === id) ?? null), ready: raw !== undefined }),
    [raw, id],
  );
}
