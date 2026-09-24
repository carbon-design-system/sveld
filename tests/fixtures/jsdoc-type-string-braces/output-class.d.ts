import { SvelteComponentTyped } from "svelte";

export type Config = {
  /** Key with a closing brace. */
  weird: { "a}": string };
  /** Template literal type. */
  prefixed: `x-${string}`;
  /** Open brace literal. */
  brace: "{";
  /** Escaped quote before a brace. */
  escaped: '\'}';
};

export type JsdocTypeStringBracesProps = {
  config: Config;
};

export default class JsdocTypeStringBraces extends SvelteComponentTyped<
  JsdocTypeStringBracesProps,
  Record<string, any>,
  Record<string, never>
> {}
