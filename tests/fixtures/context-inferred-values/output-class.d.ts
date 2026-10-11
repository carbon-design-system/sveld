import { SvelteComponentTyped } from "svelte";

export type MenuContext = {
  query: import("svelte/store").Writable<string>;
  size: import("svelte/store").Writable<"sm" | "md" | "lg">;
  disabled: import("svelte/store").Writable<boolean>;
  highlightedId: import("svelte/store").Writable<string | null>;
  items: import("svelte/store").Writable<any[]>;
  hasItems: import("svelte/store").Readable<any>;
  isEmpty: import("svelte/store").Readable<boolean>;
  max: import("svelte/store").Readable<number>;
  fallbackName: any;
  notifyOpen: (id: any) => any;
  claim: (id: string) => boolean;
  reset: () => any;
};

export type ContextInferredValuesProps = {
  /**
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * @default false
   */
  disabled?: boolean;

  children?: (this: void) => void;
};

export default class ContextInferredValues extends SvelteComponentTyped<
  ContextInferredValuesProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
