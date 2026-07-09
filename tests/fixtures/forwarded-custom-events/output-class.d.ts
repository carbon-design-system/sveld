import { SvelteComponentTyped } from "svelte";

export type ForwardedCustomEventsProps = Record<string, never>;

export default class ForwardedCustomEvents extends SvelteComponentTyped<
  ForwardedCustomEventsProps,
  {
    /** Fired when clear button is clicked */
    clear: CustomEvent<KeyboardEvent | MouseEvent>;
    click: WindowEventMap["click"];
  },
  Record<string, never>
> {}
