import { SvelteComponentTyped } from "svelte";

export type FormContext = {
  isFluid: boolean;
};

export type FluidFormProps = {
  children?: (this: void) => void;
};

export default class FluidForm extends SvelteComponentTyped<
  FluidFormProps,
  { submit: WindowEventMap["submit"] },
  { default: Record<string, never> }
> {}
