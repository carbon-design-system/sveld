import { SvelteComponentTyped } from "svelte";
import type { LinkProps } from "./Link.svelte";

export type ExtendPropsRestSpreadProps = LinkProps;

export default class ExtendPropsRestSpread extends SvelteComponentTyped<
  ExtendPropsRestSpreadProps,
  Record<string, any>,
  Record<string, never>
> {}
