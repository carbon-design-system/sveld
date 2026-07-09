import { SvelteComponentTyped } from "svelte";

export type RunesHostCustomElementProps = {
  /**
   * @default undefined
   */
  value: undefined;
};

export default class RunesHostCustomElement extends SvelteComponentTyped<
  RunesHostCustomElementProps,
  {
    close: CustomEvent<null>;
    notify: CustomEvent<any>;
    ready: CustomEvent<"loaded">;
  },
  Record<string, never>
> {}
