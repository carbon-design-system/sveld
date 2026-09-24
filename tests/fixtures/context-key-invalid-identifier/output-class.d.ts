import { SvelteComponentTyped } from "svelte";

export type ScopeCtxContext = {
  count: number;
};

export type _123Context = {
  count: number;
};

export type MyKeyContext = {
  count: number;
};

export type ContextKeyInvalidIdentifierProps = Record<string, never>;

export default class ContextKeyInvalidIdentifier extends SvelteComponentTyped<
  ContextKeyInvalidIdentifierProps,
  Record<string, any>,
  Record<string, never>
> {}
