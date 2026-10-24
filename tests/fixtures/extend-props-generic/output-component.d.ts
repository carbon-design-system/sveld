import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
import type { BaseProps } from "./Base.svelte";

type $Props<T = any> = {
  /**
   * Specify the curve.
   * @default "linear"
   */
  curve?: "linear" | "monotone";
};

export type ExtendPropsGenericProps<T = any> = Omit<BaseProps<T>, keyof $Props<T>> & $Props<T>;

export type ExtendPropsGenericExports = Record<string, never>;

interface ExtendPropsGenericComponent {
  new <T = any>(
    options: ComponentConstructorOptions<ExtendPropsGenericProps<T>>
  ): SvelteComponent<ExtendPropsGenericProps<T>> & ExtendPropsGenericExports;
  <T = any>(
    this: void,
    internals: ComponentInternals,
    props: ExtendPropsGenericProps<T>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<ExtendPropsGenericProps<T>>): void;
  } & ExtendPropsGenericExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ExtendPropsGeneric: ExtendPropsGenericComponent;
export default ExtendPropsGeneric;
