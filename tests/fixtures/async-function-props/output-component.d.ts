import type { Component } from "svelte";

export type AsyncFunctionPropsProps = {
  validate?: (id: number) => Promise<boolean>;
};

export type AsyncFunctionPropsExports = {
  initialize: () => Promise<void>;

  fetchData: (url: string) => Promise<Response>;
};

declare const AsyncFunctionProps: Component<
  AsyncFunctionPropsProps,
  AsyncFunctionPropsExports,
  ""
>;
export default AsyncFunctionProps;
