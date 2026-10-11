import type { Component } from "svelte";

export type FormContext = {
  "aria-label": string;
  "data-id": number;
  "0": boolean;
  plain: string;
};

export type ContextPropertyKeysProps = Record<string, never>;

export type ContextPropertyKeysExports = Record<string, never>;

declare const ContextPropertyKeys: Component<
  ContextPropertyKeysProps,
  ContextPropertyKeysExports,
  ""
>;
export default ContextPropertyKeys;
