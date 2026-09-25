import type { Component } from "svelte";

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

export type ModuleClassSpecifierExports = Record<string, never>;

declare const ModuleClassSpecifier: Component<
  ModuleClassSpecifierProps,
  ModuleClassSpecifierExports,
  ""
>;
export default ModuleClassSpecifier;
