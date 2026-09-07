import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsObjectDetailProps = {
  id: string;
};

export default class DispatchedEventsObjectDetail extends SvelteComponentTyped<
  DispatchedEventsObjectDetailProps,
  {
    items: CustomEvent<number[]>;
    save: CustomEvent<{ id: string }>;
  },
  Record<string, never>
> {}
