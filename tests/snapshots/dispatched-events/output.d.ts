/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface InputProps {}

export default class Input extends SvelteComponentTyped<
  InputProps,
  {
    hover: CustomEvent<any>;
    destroy: CustomEvent<any>;
    ["destroy--component"]: CustomEvent<any>;
    ["destroy:component"]: CustomEvent<any>;
  },
  { default: {} }
> {}
