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

const storedTheme = getStoredTheme();

export const theme = writable<Theme>(storedTheme ?? getSystemTheme());

/** Follow the system color scheme until the user picks a theme. */
export const followSystem = writable(storedTheme === null);

export function toggleTheme() {
  followSystem.set(false);
  theme.update((value) => {
    const next = value === "g100" ? "white" : "g100";
    localStorage.setItem(STORAGE_KEY, next);
    return next;
  });
}
