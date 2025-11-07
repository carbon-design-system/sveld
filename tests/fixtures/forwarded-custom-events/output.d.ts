import type { SvelteComponentTyped } from "svelte";

export type ForwardedCustomEventsProps = {};

export default class ForwardedCustomEvents extends SvelteComponentTyped<
  ForwardedCustomEventsProps,
  {
    /** Fired when clear button is clicked */ clear: CustomEvent<KeyboardEvent | MouseEvent>;
    click: WindowEventMap["click"];
  },
  {}
> {}
