import type { Component } from "svelte";
import type { LinkProps } from "./Link.svelte";

type $Props = {};

export type ExtendPropsRestSpreadProps = Omit<LinkProps, keyof $Props> & $Props;

export type ExtendPropsRestSpreadExports = Record<string, never>;

declare const ExtendPropsRestSpread: Component<
  ExtendPropsRestSpreadProps,
  ExtendPropsRestSpreadExports,
  ""
>;
export default ExtendPropsRestSpread;
