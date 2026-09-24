import { SvelteComponentTyped } from "svelte";

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
};

export default class RegexBigintLiterals extends SvelteComponentTyped<
  RegexBigintLiteralsProps,
  {
    match: CustomEvent<{
        pattern: RegExp;
        count: bigint;
      }>;
  },
  Record<string, never>
> {}
