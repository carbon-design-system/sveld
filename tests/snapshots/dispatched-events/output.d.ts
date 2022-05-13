/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps {}

export default class Input extends SvelteComponentTyped<
  InputProps,
  {
    hover: CustomEvent<any>;
    destroy: CustomEvent<null>;
    ["destroy--component"]: CustomEvent<null>;
    ["destroy:component"]: CustomEvent<null>;
  },
  { default: {} }
> {}
