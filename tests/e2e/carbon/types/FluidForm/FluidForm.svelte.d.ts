import type { SvelteComponentTyped } from "svelte";

export type FormContext = {
  isFluid: boolean;
};

export type FluidFormProps = Record<string, never>;

export default class FluidForm extends SvelteComponentTyped<
  FluidFormProps,
  { submit: WindowEventMap["submit"] },
  { default: Record<string, never> }
> {}
