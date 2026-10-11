import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsDetailLiteralsProps = {
  id: string;
};

export default class DispatchedEventsDetailLiterals extends SvelteComponentTyped<
  DispatchedEventsDetailLiteralsProps,
  {
    clear: CustomEvent<null>;
    items: CustomEvent<number[]>;
    save: CustomEvent<{ id: string }>;
    status: CustomEvent<"done">;
  },
  Record<string, never>
> {}
