import type { Component } from "svelte";

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

export type JsdocTypeStringBracesExports = Record<string, never>;

declare const JsdocTypeStringBraces: Component<
  JsdocTypeStringBracesProps,
  JsdocTypeStringBracesExports,
  ""
>;
export default JsdocTypeStringBraces;
