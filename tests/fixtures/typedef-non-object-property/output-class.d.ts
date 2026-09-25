import { SvelteComponentTyped } from "svelte";

export type RowClass = string | ((row: string) => string | undefined);

export type TypedefNonObjectPropertyProps = {
  /**
   * @default undefined
   */
  rowClass?: RowClass;
};

export default class TypedefNonObjectProperty extends SvelteComponentTyped<
  TypedefNonObjectPropertyProps,
  {
    "click:cell": CustomEvent<{
        cell: string;
      }>;
  },
  Record<string, never>
> {}
