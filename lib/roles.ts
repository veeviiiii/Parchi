// Who the visitor is, and what each role can see and post (FEATURES_V2 section 3).
// Plain code only. The server checks these rules on every Crowdmind request.

export type Role = "consumer" | "community" | "merchant";

export const ROLES: Role[] = ["consumer", "community", "merchant"];

export const ROLE_LABEL: Record<Role, string> = {
  consumer: "Consumer",
  community: "Community",
  merchant: "Merchant",
};

export const ROLE_PITCH: Record<Role, string> = {
  consumer: "I'm buying for myself",
  community: "I collect orders for my group: hostel, class, society, club",
  merchant: "I run a shop",
};

// What the profile's `name` means for each role.
export const NAME_LABEL: Record<Role, string> = {
  consumer: "Your name",
  community: "Group name",
  merchant: "Shop name",
};

// The "Order" nav link's label.
export const ORDER_LABEL: Record<Role, string> = {
  consumer: "My list",
  community: "Group order",
  merchant: "Customer orders",
};

// Crowdmind spaces are named after the role that reads them.
export const SPACE_LABEL: Record<Role, string> = {
  consumer: "Buyers",
  community: "Communities",
  merchant: "Merchants",
};

// Who may post into each space.
const POSTERS: Record<Role, Role[]> = {
  consumer: ["consumer", "community", "merchant"],
  community: ["community", "merchant"],
  merchant: ["merchant", "community"],
};

export function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role);
}

// Each role reads only its own space.
export function canRead(role: Role, space: Role): boolean {
  return role === space;
}

export function canPost(role: Role, space: Role): boolean {
  return POSTERS[space].includes(role);
}

// The spaces this role may post into, own space first.
export function postableSpaces(role: Role): Role[] {
  return [role, ...ROLES.filter((space) => space !== role && canPost(role, space))];
}
