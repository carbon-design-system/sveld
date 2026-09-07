import { SvelteComponentTyped } from "svelte";

export type RunesHostCustomElementProps = {
  value: any;
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
