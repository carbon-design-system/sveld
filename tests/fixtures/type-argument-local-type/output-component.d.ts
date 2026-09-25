import type { Component } from "svelte";

interface Item {
  id: string;
}

type Status = "idle" | "busy";

export type TypeArgumentLocalTypeProps = {
  /**
   * @default []
   */
  items?: Array<Item>;

  /**
   * @default new Map()
   */
  statuses?: Map<string, Status>;
};

export type TypeArgumentLocalTypeExports = Record<string, never>;

declare const TypeArgumentLocalType: Component<
  TypeArgumentLocalTypeProps,
  TypeArgumentLocalTypeExports,
  ""
>;
export default TypeArgumentLocalType;
