import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type TreeNode = {
  text?: string;
  nodes?: TreeNode[];
};

export type TypedefTemplateUnusedProps<Node extends TreeNode = TreeNode> = {
  /**
   * @default []
   */
  nodes?: ReadonlyArray<Node>;
};

export type TypedefTemplateUnusedExports = Record<string, never>;

interface TypedefTemplateUnusedComponent {
  new <Node extends TreeNode = TreeNode>(
    options: ComponentConstructorOptions<TypedefTemplateUnusedProps<Node>>
  ): SvelteComponent<TypedefTemplateUnusedProps<Node>> & TypedefTemplateUnusedExports;
  <Node extends TreeNode = TreeNode>(
    this: void,
    internals: ComponentInternals,
    props: TypedefTemplateUnusedProps<Node>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<TypedefTemplateUnusedProps<Node>>): void;
  } & TypedefTemplateUnusedExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const TypedefTemplateUnused: TypedefTemplateUnusedComponent;
export default TypedefTemplateUnused;
