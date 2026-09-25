import { SvelteComponentTyped } from "svelte";

export type RunesHostDispatchDetailInferenceProps = Record<string, never>;

export default class RunesHostDispatchDetailInference extends SvelteComponentTyped<
  RunesHostDispatchDetailInferenceProps,
  {
    change: CustomEvent<{
        count: number;
        label: string;
      }>;
    tick: CustomEvent<number>;
  },
  Record<string, never>
> {}
