import { SvelteComponentTyped } from "svelte";

export type RunesHostDispatchProps = {
  value: any;
};

export default class RunesHostDispatch extends SvelteComponentTyped<
  RunesHostDispatchProps,
  {
    change: CustomEvent<{
        count: number;
        label: string;
      }>;
    close: CustomEvent<null>;
    notify: CustomEvent<any>;
    ready: CustomEvent<"loaded">;
    tick: CustomEvent<number>;
  },
  Record<string, never>
> {}
