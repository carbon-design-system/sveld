/** Supported color themes. */
export type Theme = "light" | "dark";

export interface ThemeConfig {
  theme: Theme;
  persist: boolean;
}
