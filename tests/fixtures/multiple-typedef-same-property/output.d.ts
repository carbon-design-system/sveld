import { SvelteComponentTyped } from "svelte";

export type UserConfig = { /** User identifier */ id: string /** User display name */; name: string };

export type ThemeConfig = { /** Theme identifier */ id: string /** Theme display name */; name: string };

export type MultipleTypedefSamePropertyProps = {
  /**
   * @default { id: "1", name: "Admin" }
   */
  user?: UserConfig;

  /**
   * @default { id: "default", name: "Default" }
   */
  theme?: ThemeConfig;
};

export default class MultipleTypedefSameProperty extends SvelteComponentTyped<
  MultipleTypedefSamePropertyProps,
  Record<string, any>,
  Record<string, never>
> {}
