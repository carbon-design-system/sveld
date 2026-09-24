import type { Component } from "svelte";

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

export type ContextKeyInvalidIdentifierExports = Record<string, never>;

declare const ContextKeyInvalidIdentifier: Component<
  ContextKeyInvalidIdentifierProps,
  ContextKeyInvalidIdentifierExports,
  ""
>;
export default ContextKeyInvalidIdentifier;
