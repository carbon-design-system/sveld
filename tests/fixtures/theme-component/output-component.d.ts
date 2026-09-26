import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

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

  children?: (this: void, ...args: [{ theme: CarbonTheme }]) => void;
};

export type ThemeComponentExports = Record<string, never>;

type $Events = {
  update: CustomEvent<{
      theme: CarbonTheme;
    }>;
};

interface ThemeComponentComponent {
  new (
    options: ComponentConstructorOptions<ThemeComponentProps>
  ): SvelteComponent<ThemeComponentProps, $Events> & ThemeComponentExports;
  (
    this: void,
    internals: ComponentInternals,
    props: ThemeComponentProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<ThemeComponentProps>): void;
  } & ThemeComponentExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ThemeComponent: ThemeComponentComponent;
export default ThemeComponent;
