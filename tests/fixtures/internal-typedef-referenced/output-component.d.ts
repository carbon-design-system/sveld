import type { Component } from "svelte";

export interface InternalCount {
  count: number
}

export interface PublicList {
  items: InternalCount[]
}

export type InternalTypedefReferencedProps = {
  list: PublicList;
};

export type InternalTypedefReferencedExports = Record<string, never>;

declare const InternalTypedefReferenced: Component<
  InternalTypedefReferencedProps,
  InternalTypedefReferencedExports,
  ""
>;
export default InternalTypedefReferenced;
