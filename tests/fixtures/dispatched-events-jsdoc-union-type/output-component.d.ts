import type { Component } from "svelte";

export type DispatchedEventsJsdocUnionTypeProps = {
  /** Dispatched when a sortable column header would change the active sort. */
  onsort?: (event: CustomEvent<{
        key: null;
        direction: "none"
      } | {
        key: string;
        direction: "ascending" | "descending"
      }>) => void;
};

export type DispatchedEventsJsdocUnionTypeExports = Record<string, never>;

declare const DispatchedEventsJsdocUnionType: Component<
  DispatchedEventsJsdocUnionTypeProps,
  DispatchedEventsJsdocUnionTypeExports,
  ""
>;
export default DispatchedEventsJsdocUnionType;
