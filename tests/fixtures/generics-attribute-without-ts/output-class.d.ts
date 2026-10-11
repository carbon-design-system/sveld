import { SvelteComponentTyped } from "svelte";

export type GenericsAttributeWithoutTsProps = {
  row: any;
};

export default class GenericsAttributeWithoutTs extends SvelteComponentTyped<
  GenericsAttributeWithoutTsProps,
  Record<string, any>,
  Record<string, never>
> {}
