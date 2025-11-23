<script context="module">
  /** @type {Record<CarbonTheme, string>} */
  export const themes = {
    white: "White",
    g10: "Gray 10",
    g80: "Gray 80",
    g90: "Gray 90",
    g100: "Gray 100",
  };
</script>

<script>
  /**
   * Dynamic, client-side theming using CSS variables
   */

  /**
   * @typedef {"white" | "g10" | "g80" | "g90" | "g100"} CarbonTheme
   * @event update
   * @type {object}
   * @property {CarbonTheme} theme
   * @slot {{ theme: CarbonTheme; }}
   */

  /**
   * Set the current Carbon theme
   * @type {CarbonTheme}
   */
  export let theme = "white";

  /**
   * Customize a theme with your own tokens
   * @see https://carbondesignsystem.com/guidelines/themes/overview#customizing-a-theme
   * @type {{ [token: string]: any; }}
   */
  export let tokens = {};

  /** Set to `true` to persist the theme using window.localStorage */
  export let persist = false;

  /** Specify the local storage key */
  export let persistKey = "theme";
</script>

<slot {theme} />
