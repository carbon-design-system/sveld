import type { Component } from "svelte";

export type Config = {
  /** Count */
  count: number;
};

export type TypedefDuplicateNameProps = {
  config: Config;
};

export type TypedefDuplicateNameExports = Record<string, never>;

declare const TypedefDuplicateName: Component<
  TypedefDuplicateNameProps,
  TypedefDuplicateNameExports,
  ""
>;
export default TypedefDuplicateName;
