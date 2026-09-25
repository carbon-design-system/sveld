import { SvelteComponentTyped } from "svelte";

/**
 * Counts things.
 */
export declare class Counter {
  constructor(start: number);

  count: number;

  increment(): Counter;
}
export { Counter as Tally };
export { Counter as "counter-class" };

export type ModuleClassSpecifierProps = Record<string, never>;

export default class ModuleClassSpecifier extends SvelteComponentTyped<
  ModuleClassSpecifierProps,
  Record<string, any>,
  Record<string, never>
> {}
