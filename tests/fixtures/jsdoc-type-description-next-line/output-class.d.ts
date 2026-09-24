import { SvelteComponentTyped } from "svelte";

export type JsdocTypeDescriptionNextLineProps = {
  /** Header content. */
  header?: (this: void, ...args: [{ title: string }]) => void;

  /** Renders each item. */
  children?: (this: void, ...args: [{ item: string }]) => void;
};

export default class JsdocTypeDescriptionNextLine extends SvelteComponentTyped<
  JsdocTypeDescriptionNextLineProps,
  {
    /** Fired on change. */
    change: CustomEvent<{ value: string }>;
  },
  {
    /** Renders each item. */
    default: { item: string };
    /** Header content. */
    header: { title: string };
  }
> {}
