import { SvelteComponentTyped } from "svelte";

export type RunesSnippetDescriptionHyphensProps = {
  /**
   * @default undefined
   */
  row: undefined;

  /**
   * @default undefined
   */
  col: undefined;

  /**
   * First line documents `row-id` binding.
   * Second line: column-id and drag-and-drop targets share one surface.
   */
  children?: (this: void, ...args: [{
        row: string;
        col: string
      }]) => void;
};

export default class RunesSnippetDescriptionHyphens extends SvelteComponentTyped<
  RunesSnippetDescriptionHyphensProps,
  Record<string, any>,
  {
    /**
     * First line documents `row-id` binding.
     * Second line: column-id and drag-and-drop targets share one surface.
     */
    default: {
      row: string;
      col: string
    };
  }
> {}
