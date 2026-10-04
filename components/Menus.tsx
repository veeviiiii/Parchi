"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

// The design's dropdown: a pill button that opens a small popover. Closes on outside click or Escape.
function Dropdown({ id, label, button, children }: { id: string; label: string; button: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    addEventListener("click", onClick);
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("click", onClick);
      removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="tsel" ref={box}>
      <button className="tbtn" type="button" aria-label={label} title={label} aria-haspopup="true" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {button}
      </button>
      <div className="tpop" id={id} role="radiogroup" aria-label={label} hidden={!open}>
        {children(() => setOpen(false))}
      </div>
    </div>
  );
}

// ---- Theme: saved in localStorage "parchi-theme", applied as <html data-theme>. ----

const THEMES = [
  { id: "classic", name: "Parchi Classic", swatch: "sc" },
  { id: "vintage", name: "Parchi Vintage", swatch: "sv" },
  { id: "mono", name: "Parchi Mono", swatch: "sm" },
];
const THEME_EVENT = "parchi-theme-changed";

function subscribeTheme(onChange: () => void) {
  addEventListener(THEME_EVENT, onChange);
  return () => removeEventListener(THEME_EVENT, onChange);
}

function setTheme(theme: string) {
  const root = document.documentElement;
  root.classList.add("tt"); // smooth colour change, as in the design
  root.dataset.theme = theme;
  try {
    localStorage.setItem("parchi-theme", theme);
  } catch {
    // private browsing: the theme just won't be remembered
  }
  dispatchEvent(new Event(THEME_EVENT));
  setTimeout(() => root.classList.remove("tt"), 800);
}

export function ThemeMenu({ label = "Theme" }: { label?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, () => document.documentElement.dataset.theme ?? "classic", () => "classic");
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  return (
    <Dropdown
      id="tpop"
      label="Theme"
      button={
        <>
          <span className={`sw ${current.swatch}`} id="tsw" />
          <span className="tl">{label}</span>
        </>
      }
    >
      {(close) =>
        THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="topt"
            role="radio"
            aria-checked={t.id === theme}
            onClick={() => {
              setTheme(t.id);
              close();
            }}
          >
            <span className={`sw ${t.swatch}`} />
            {t.name}
          </button>
        ))
      }
    </Dropdown>
  );
}

// ---- Language: only English and Hindi are translated; the rest are placeholders that show English. ----

export const LANGUAGES = [
  ["en", "English"],
  ["hi", "हिन्दी"],
  ["bn", "বাংলা"],
  ["gu", "ગુજરાતી"],
  ["mr", "मराठी"],
  ["ta", "தமிழ்"],
  ["te", "తెలుగు"],
  ["kn", "ಕನ್ನಡ"],
  ["ml", "മലയാളം"],
  ["pa", "ਪੰਜਾਬੀ"],
  ["or", "ଓଡ଼ିଆ"],
  ["as", "অসমীয়া"],
];
const LANG_EVENT = "parchi-lang-changed";

function readLang() {
  try {
    return localStorage.getItem("parchi-lang") ?? "en";
  } catch {
    return "en";
  }
}

function subscribeLang(onChange: () => void) {
  addEventListener(LANG_EVENT, onChange);
  return () => removeEventListener(LANG_EVENT, onChange);
}

export function useLanguage(): string {
  return useSyncExternalStore(subscribeLang, readLang, () => "en");
}

export function LanguageMenu({ label }: { label: string }) {
  const lang = useLanguage();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <Dropdown
      id="lpop"
      label="Language"
      button={
        <>
          <span className="sw" style={{ display: "grid", placeItems: "center", fontSize: ".8rem" }}>
            अ
          </span>
          <span className="tl">{label}</span>
        </>
      }
    >
      {(close) =>
        LANGUAGES.map(([code, name]) => (
          <button
            key={code}
            type="button"
            className="topt lopt"
            role="radio"
            aria-checked={code === lang}
            lang={code}
            onClick={() => {
              try {
                localStorage.setItem("parchi-lang", code);
              } catch {
                // not remembered in private browsing
              }
              dispatchEvent(new Event(LANG_EVENT));
              close();
            }}
          >
            {name}
          </button>
        ))
      }
    </Dropdown>
  );
}
