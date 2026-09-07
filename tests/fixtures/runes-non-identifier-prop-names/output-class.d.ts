import { SvelteComponentTyped } from "svelte";

export type RunesNonIdentifierPropNamesProps = {
  "data-foo": any;

  "123abc": any;

  normal: any;

  "icon-left"?: (this: void) => void;
};

export default class RunesNonIdentifierPropNames extends SvelteComponentTyped<
  RunesNonIdentifierPropNamesProps,
  { "item:select": CustomEvent<null> },
  { "icon-left": Record<string, never> }
> {}
