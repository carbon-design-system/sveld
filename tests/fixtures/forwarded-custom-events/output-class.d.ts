import { SvelteComponentTyped } from "svelte";

export type ForwardedCustomEventsProps = Record<string, never>;

export default class ForwardedCustomEvents extends SvelteComponentTyped<
  ForwardedCustomEventsProps,
  {
    /** Fired when clear button is clicked */
    clear: CustomEvent<KeyboardEvent | MouseEvent>;
    click: WindowEventMap["click"];
    /** Dismiss button clicked with no data */
    dismiss: CustomEvent<null>;
    /** Shares a native event name, but the child dispatches it */
    reset: CustomEvent<null>;
    /** Search query changed */
    search: CustomEvent<string>;
  },
  Record<string, never>
> {}
