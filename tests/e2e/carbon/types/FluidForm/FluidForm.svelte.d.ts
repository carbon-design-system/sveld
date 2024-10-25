import type { SvelteComponentTyped } from "svelte";

export type FluidFormProps = {};

export default class FluidForm extends SvelteComponentTyped<
  FluidFormProps,
  { submit: WindowEventMap["submit"] },
  { default: {} }
> {}
