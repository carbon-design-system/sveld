import { SvelteComponentTyped } from "svelte";

export type FormContext = {
  "aria-label": string;
  "data-id": number;
  "0": boolean;
  plain: string;
};

export type ContextPropertyKeysProps = Record<string, never>;

export default class ContextPropertyKeys extends SvelteComponentTyped<
  ContextPropertyKeysProps,
  Record<string, any>,
  Record<string, never>
> {}
