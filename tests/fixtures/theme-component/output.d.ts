import { SvelteComponentTyped } from "svelte";

export declare const themes: Record<CarbonTheme, string>;

export type CarbonTheme = "white" | "g10" | "g80" | "g90" | "g100";

export type ThemeComponentProps = {
  /**
   * Set the current Carbon theme
   * @default "white"
   */
  theme?: CarbonTheme;

  /**
   * Customize a theme with your own tokens
   * @see https://carbondesignsystem.com/guidelines/themes/overview#customizing-a-theme
   * @default {}
   */
  tokens?: { [token: string]: any };

  /**
   * Set to `true` to persist the theme using window.localStorage
   * @default false
   */
  persist?: boolean;

  /**
   * Specify the local storage key
   * @default "theme"
   */
  persistKey?: string;
};

export default class ThemeComponent extends SvelteComponentTyped<
  ThemeComponentProps,
  { update: CustomEvent<{ theme: CarbonTheme }> },
  { default: { theme: CarbonTheme } }
> {}
