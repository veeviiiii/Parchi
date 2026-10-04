// The visitor's self-chosen role and name, kept in this browser only.
// No login: roles are self-selected for the demo (FEATURES_V2 section 3).
import { useMemo, useSyncExternalStore } from "react";
import { isRole, type Role } from "./roles";

export type Profile = { role: Role; name: string };

const KEY = "parchi.profile";
const CHANGED = "parchi-profile-changed"; // tells this tab the profile changed

function parse(raw: string | null): Profile | null {
  try {
    const saved = JSON.parse(raw ?? "null");
    if (saved && isRole(saved.role) && typeof saved.name === "string" && saved.name.trim()) {
      return { role: saved.role, name: saved.name.trim().slice(0, 40) };
    }
  } catch {
    // broken JSON counts as "no profile"
  }
  return null;
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ role: profile.role, name: profile.name.trim().slice(0, 40) }));
  } catch {
    // private browsing: the app still works for this visit
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange); // other tabs
  window.addEventListener(CHANGED, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

// `ready` is false during the first server render, before the browser has been checked.
export function useProfile(): { profile: Profile | null; ready: boolean } {
  const raw = useSyncExternalStore(subscribe, readRaw, () => undefined);
  return useMemo(() => ({ profile: raw === undefined ? null : parse(raw), ready: raw !== undefined }), [raw]);
}
