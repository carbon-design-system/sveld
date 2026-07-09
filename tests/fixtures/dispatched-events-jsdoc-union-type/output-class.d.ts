import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsJsdocUnionTypeProps = Record<string, never>;

export default class DispatchedEventsJsdocUnionType extends SvelteComponentTyped<
  DispatchedEventsJsdocUnionTypeProps,
  {
    /** Dispatched when a sortable column header would change the active sort. */
    sort: CustomEvent<{
        key: null;
        direction: "none"
      } | {
        key: string;
        direction: "ascending" | "descending"
      }>;
  },
  Record<string, never>
> {}
