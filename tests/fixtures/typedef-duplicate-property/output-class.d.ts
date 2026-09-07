import { SvelteComponentTyped } from "svelte";

export type Config = {
  /** Second declaration wins */
  id: number;
};

export type TypedefDuplicatePropertyProps = {
  config: Config;
};

export default class TypedefDuplicateProperty extends SvelteComponentTyped<
  TypedefDuplicatePropertyProps,
  Record<string, any>,
  Record<string, never>
> {}
