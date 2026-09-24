import type { Component } from "svelte";

export type EventDescriptionAmbiguousProps = {
  /** Fired when the menu loses focus. */
  onblur?: (event: CustomEvent<null>) => void;

  /** Fired when the user selects an item. */
  onclear?: (event: CustomEvent<null>) => void;

  onclose?: (event: CustomEvent<null>) => void;

  /** Fired when the menu gains focus. */
  onfocus?: (event: CustomEvent<null>) => void;

  /** Fired when the menu opens. */
  onopen?: (event: CustomEvent<{ value: string }>) => void;

  onselect?: (event: CustomEvent<{ value: string }>) => void;
};

export type EventDescriptionAmbiguousExports = Record<string, never>;

declare const EventDescriptionAmbiguous: Component<
  EventDescriptionAmbiguousProps,
  EventDescriptionAmbiguousExports,
  ""
>;
export default EventDescriptionAmbiguous;
