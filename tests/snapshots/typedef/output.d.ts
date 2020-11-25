/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

export interface MyTypedef {
  [key: string]: boolean;
}

export interface InputProps {
  /**
   * @default "id-" + Math.random().toString(36)
   */
  id?: string;

  /**
   * @default { ["1"]: true }
   */
  prop1?: MyTypedef;
}

export default class Input extends SvelteComponent<InputProps, {}, { default: { prop1: MyTypedef } }> {}
