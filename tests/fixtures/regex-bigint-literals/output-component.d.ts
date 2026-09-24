import type { Component } from "svelte";

export type MatcherContext = {
  pattern: RegExp;
  limit: bigint;
};

export type RegexBigintLiteralsProps = {
  /**
   * Pattern to match
   * @default /^[a-z]+$/i
   */
  pattern?: RegExp;

  /**
   * Large counter
   * @default 10n
   */
  total?: bigint;

  onmatch?: (event: CustomEvent<{
        pattern: RegExp;
        count: bigint;
      }>) => void;
};

export type RegexBigintLiteralsExports = Record<string, never>;

declare const RegexBigintLiterals: Component<
  RegexBigintLiteralsProps,
  RegexBigintLiteralsExports,
  ""
>;
export default RegexBigintLiterals;
