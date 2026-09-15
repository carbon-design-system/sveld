import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type GenericsTemplateFunctionScopedProps<Node extends { id: string | number } = { id: string | number }> = {
  /**
   * @generics Node
   * @default { id: "1" }
   */
  node?: { id: "1" };
};

export type GenericsTemplateFunctionScopedExports = Record<string, never>;

interface GenericsTemplateFunctionScopedComponent {
  new <Node extends { id: string | number } = { id: string | number }>(
    options: ComponentConstructorOptions<GenericsTemplateFunctionScopedProps<Node>>
  ): SvelteComponent<GenericsTemplateFunctionScopedProps<Node>> & GenericsTemplateFunctionScopedExports;
  <Node extends { id: string | number } = { id: string | number }>(
    this: void,
    internals: ComponentInternals,
    props: GenericsTemplateFunctionScopedProps<Node>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<GenericsTemplateFunctionScopedProps<Node>>): void;
  } & GenericsTemplateFunctionScopedExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const GenericsTemplateFunctionScoped: GenericsTemplateFunctionScopedComponent;
export default GenericsTemplateFunctionScoped;
