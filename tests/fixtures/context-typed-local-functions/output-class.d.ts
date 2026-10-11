import { SvelteComponentTyped } from "svelte";

export type ListContext = {
  select: (id: string) => void;
  count: (items: string[]) => number;
};

export type ContextTypedLocalFunctionsProps = Record<string, never>;

export default class ContextTypedLocalFunctions extends SvelteComponentTyped<
  ContextTypedLocalFunctionsProps,
  Record<string, any>,
  Record<string, never>
> {}
