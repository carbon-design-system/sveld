import { SvelteComponentTyped } from "svelte";

export type Config = {
  /** Count */
  count: number;
};

export type TypedefDuplicateNameProps = {
  config: Config;
};

export default class TypedefDuplicateName extends SvelteComponentTyped<
  TypedefDuplicateNameProps,
  Record<string, any>,
  Record<string, never>
> {}
