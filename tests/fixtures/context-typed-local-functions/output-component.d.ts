import type { Component } from "svelte";

export type ListContext = {
  select: (id: string) => void;
  count: (items: string[]) => number;
};

export type ContextTypedLocalFunctionsProps = Record<string, never>;

export type ContextTypedLocalFunctionsExports = Record<string, never>;

declare const ContextTypedLocalFunctions: Component<
  ContextTypedLocalFunctionsProps,
  ContextTypedLocalFunctionsExports,
  ""
>;
export default ContextTypedLocalFunctions;
