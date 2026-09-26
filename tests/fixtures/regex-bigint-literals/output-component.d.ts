import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

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

export type RegexBigintLiteralsExports = Record<string, never>;

type $Events = {
  match: CustomEvent<{
      pattern: RegExp;
      count: bigint;
    }>;
};

interface RegexBigintLiteralsComponent {
  new (
    options: ComponentConstructorOptions<RegexBigintLiteralsProps>
  ): SvelteComponent<RegexBigintLiteralsProps, $Events> & RegexBigintLiteralsExports;
  (
    this: void,
    internals: ComponentInternals,
    props: RegexBigintLiteralsProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<RegexBigintLiteralsProps>): void;
  } & RegexBigintLiteralsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RegexBigintLiterals: RegexBigintLiteralsComponent;
export default RegexBigintLiterals;
