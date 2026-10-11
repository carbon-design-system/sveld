import { SvelteComponentTyped } from "svelte";

export type RestPropsUnresolvedProps = Record<string, never>;

export default class RestPropsUnresolved extends SvelteComponentTyped<
  RestPropsUnresolvedProps,
  Record<string, any>,
  Record<string, never>
> {}
