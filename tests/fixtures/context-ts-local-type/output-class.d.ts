import { SvelteComponentTyped } from "svelte";
import type { Writable } from "svelte/store";

interface ModalAPI {
  open: () => void;
  close: () => void;
}

type Density = "compact" | "comfortable";

export type ModalContext = ModalAPI;

export type LayoutContext = {
  density: Density;
  zoom: Writable<number>;
};

export type ContextTsLocalTypeProps = {
  children?: (this: void) => void;
};

export default class ContextTsLocalType extends SvelteComponentTyped<
  ContextTsLocalTypeProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
