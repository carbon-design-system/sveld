import { SvelteComponentTyped } from "svelte";

export type GenericsTemplateFunctionScopedProps<Node extends { id: string | number } = { id: string | number }> = {
  /**
   * @generics {Node extends { id: string | number } = { id: string | number }} Node
   * @default { id: "1" }
   */
  node?: { id: string };
};

export default class GenericsTemplateFunctionScoped<Node extends { id: string | number } = { id: string | number }> extends SvelteComponentTyped<
  GenericsTemplateFunctionScopedProps<Node>,
  Record<string, any>,
  Record<string, never>
> {}
