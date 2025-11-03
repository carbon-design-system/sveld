import type { SvelteComponentTyped } from "svelte";

export type MixedEventTypesProps = Record<string, never>;

export default class MixedEventTypes extends SvelteComponentTyped<
  MixedEventTypesProps,
  {
    /** Input value changed (native forwarded event) */ input: CustomEvent<string>;
    /** Custom event from component (component forwarded event) */
    customEvent: CustomEvent<number>;
    change: WindowEventMap["change"];
    submit: CustomEvent<any>;
  },
  Record<string, never>
> {}
