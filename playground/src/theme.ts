import { writable } from "svelte/store";

export type Theme = "white" | "g100";

const STORAGE_KEY = "theme";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") {
    return "g100";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "g100" : "white";
}

function getStoredTheme(): Theme | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "white" || stored === "g100") {
    return stored;
  }

  return null;
}

function getInitialTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme();
}

export function applyTheme(value: Theme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("theme", value);
  document.documentElement.style.colorScheme = value === "white" ? "light" : "dark";
}

export const theme = writable<Theme>(getInitialTheme());

theme.subscribe((value) => {
  applyTheme(value);
});

export function initTheme() {
  applyTheme(getInitialTheme());

  if (typeof window === "undefined") {
    return;
  }

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (!getStoredTheme()) {
      theme.set(event.matches ? "g100" : "white");
    }
  });
}

export function toggleTheme() {
  theme.update((value) => {
    const next = value === "g100" ? "white" : "g100";
    localStorage.setItem(STORAGE_KEY, next);
    return next;
  });
}
