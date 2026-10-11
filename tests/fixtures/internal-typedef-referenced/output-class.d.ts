import { SvelteComponentTyped } from "svelte";

export interface PublicList {
  items: InternalCount[]
}

export type InternalTypedefReferencedProps = {
  list: PublicList;
};

export default class InternalTypedefReferenced extends SvelteComponentTyped<
  InternalTypedefReferencedProps,
  Record<string, any>,
  Record<string, never>
> {}
