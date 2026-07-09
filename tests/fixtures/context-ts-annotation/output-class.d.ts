import { SvelteComponentTyped } from "svelte";

export type AppContext = {
  ctx: { theme: string };
};

export type LegacyContext = {
  jsdocCtx: { label: string };
};

export type ContextTsAnnotationProps = {
  children?: (this: void) => void;
};

export default class ContextTsAnnotation extends SvelteComponentTyped<
  ContextTsAnnotationProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
