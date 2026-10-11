import { SvelteComponentTyped } from "svelte";
import type { LinkProps } from "./Link.svelte";

type $Props = {};

export type ExtendPropsRestSpreadProps = Omit<LinkProps, keyof $Props> & $Props;

export default class ExtendPropsRestSpread extends SvelteComponentTyped<
  ExtendPropsRestSpreadProps,
  Record<string, any>,
  Record<string, never>
> {}
