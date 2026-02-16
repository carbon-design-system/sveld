import { SvelteComponentTyped } from "svelte";

export type UserSettingsContext = {
  /** Select an item */
  select: (id: string) => void;
  /** Clear the selection */
  clear: () => void;
};

export type ContextUnderscoreProps = Record<string, never>;

export default class ContextUnderscore extends SvelteComponentTyped<
  ContextUnderscoreProps,
  Record<string, any>,
  Record<string, never>
> {}
