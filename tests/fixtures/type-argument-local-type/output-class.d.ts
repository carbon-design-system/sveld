import { SvelteComponentTyped } from "svelte";

interface Item {
  id: string;
}

type Status = "idle" | "busy";

export type TypeArgumentLocalTypeProps = {
  /**
   * @default []
   */
  items?: Array<Item>;

  /**
   * @default new Map()
   */
  statuses?: Map<string, Status>;
};

export default class TypeArgumentLocalType extends SvelteComponentTyped<
  TypeArgumentLocalTypeProps,
  Record<string, any>,
  Record<string, never>
> {}
