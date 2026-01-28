import { SvelteComponentTyped } from "svelte";

export type SlotPropsUnionTypesProps = {
  /**
   * @default []
   */
  items?: Array<{ value: string | number; status: "pending" | "complete" | "error" }>;

  /** Header slot */
  header?: (this: void, ...args: [{ active: boolean }]) => void;

  children?: (
    this: void,
    ...args: [{ item: string | number; status: "pending" | "complete" | "error"; error: Error | null }]
  ) => void;
};

export default class SlotPropsUnionTypes extends SvelteComponentTyped<
  SlotPropsUnionTypesProps,
  Record<string, any>,
  {
    default: { item: string | number; status: "pending" | "complete" | "error"; error: Error | null };
    /** Header slot */
    header: { active: boolean };
  }
> {}
