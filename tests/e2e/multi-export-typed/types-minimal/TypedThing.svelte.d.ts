import { SvelteComponentTyped } from "svelte";

type Size = "sm" | "md" | "lg";

export type TypedThingProps = {
  /**
   * @default "sm"
   */
  size?: Size;

  children?: (this: void) => void;
};

export default class TypedThing extends SvelteComponentTyped<
  TypedThingProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
