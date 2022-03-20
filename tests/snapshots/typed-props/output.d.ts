/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * prop1 description 1
   * prop1 description 2
   * @default undefined
   */
  prop1?: string;

  /**
   * prop2 description 1
   * prop2 description 2
   * @default null
   */
  prop2?: undefined;

  /**
   * @default 4
   */
  prop3?: 4 | "4";

  /**
   * @default "red"
   */
  prop4?: "red" | "blue";
}

export default class Input extends SvelteComponentTyped<InputProps, {}, {}> {}
