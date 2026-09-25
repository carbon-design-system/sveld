import { SvelteComponentTyped } from "svelte";

type Item = { id: string };

export type DispatchedEventsIdentifierInferenceProps = Record<string, never>;

export default class DispatchedEventsIdentifierInference extends SvelteComponentTyped<
  DispatchedEventsIdentifierInferenceProps,
  {
    change: CustomEvent<{
        count: number;
        label: string;
        open: boolean;
      }>;
    count: CustomEvent<number>;
    items: CustomEvent<Item[]>;
    rename: CustomEvent<{ label: any }>;
    reroll: CustomEvent<{ roll: any }>;
    roll: CustomEvent<any>;
    select: CustomEvent<{ selected: Item | undefined }>;
    update: CustomEvent<{
        total: number;
        items: Item[];
        doubled: number;
      }>;
  },
  Record<string, never>
> {}
