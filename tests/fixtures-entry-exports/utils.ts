import type { Theme } from "./types";

/**
 * Clamps a number between a lower and upper bound.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Returns the inverse of a theme. */
export const invertTheme = (theme: Theme): Theme => (theme === "light" ? "dark" : "light");
