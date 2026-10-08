import { SvelteComponentTyped } from "svelte";

export type SlotDefaultDashDescriptionProps = {
  /**
   * @default ""
   */
  title?: string;

  /** Custom heading. */
  heading?: (this: void, ...args: [{ title: string }]) => void;

  /** Page content rendered after the header. */
  children?: (this: void) => void;
};

export default class SlotDefaultDashDescription extends SvelteComponentTyped<
  SlotDefaultDashDescriptionProps,
  Record<string, any>,
  {
    /** Page content rendered after the header. */
    default: Record<string, never>;
    /** Custom heading. */
    heading: { title: string };
  }
> {}
