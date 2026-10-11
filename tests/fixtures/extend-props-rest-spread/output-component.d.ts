import type { Component } from "svelte";
import type { LinkProps } from "./Link.svelte";

export type ExtendPropsRestSpreadProps = LinkProps;

export type ExtendPropsRestSpreadExports = Record<string, never>;

declare const ExtendPropsRestSpread: Component<
  ExtendPropsRestSpreadProps,
  ExtendPropsRestSpreadExports,
  ""
>;
export default ExtendPropsRestSpread;
