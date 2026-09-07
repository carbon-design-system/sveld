import type { Component } from "svelte";

export type Config = {
  /** Second declaration wins */
  id: number;
};

export type TypedefDuplicatePropertyProps = {
  config: Config;
};

export type TypedefDuplicatePropertyExports = Record<string, never>;

declare const TypedefDuplicateProperty: Component<
  TypedefDuplicatePropertyProps,
  TypedefDuplicatePropertyExports,
  ""
>;
export default TypedefDuplicateProperty;
