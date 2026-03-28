import { SvelteComponentTyped } from "svelte";

export type MixedEventTypesProps = Record<string, never>;

export default class MixedEventTypes extends SvelteComponentTyped<
  MixedEventTypesProps,
  {
    change: WindowEventMap["change"];
    /** Custom event from component (component forwarded event) */
    customEvent: CustomEvent<number>;
    /** Input value changed (native forwarded event) */
    input: CustomEvent<string>;
    submit: CustomEvent<any>;
  },
  Record<string, never>
> {}
