import type { Component } from "svelte";
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

export type ContextTsLocalTypeExports = Record<string, never>;

declare const ContextTsLocalType: Component<
  ContextTsLocalTypeProps,
  ContextTsLocalTypeExports,
  ""
>;
export default ContextTsLocalType;
