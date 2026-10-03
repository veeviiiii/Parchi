// Text formatting for the order sheet and the copy buttons. Plain code only.

// "gel pen" + "blue" → "Gel pen (blue)"
export function itemLabel(name: string, variant: string | null): string {
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  return variant ? `${label} (${variant})` : label;
}
