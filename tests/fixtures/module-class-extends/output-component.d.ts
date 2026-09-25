import type { Component } from "svelte";
import type { Base, Disposable, Named } from "./base.js";

/**
 * A store built on `Base`
 */
export declare class Store<T> extends Base<T> implements Disposable {
  dispose(): void;
}

export declare class NamedStore extends Store<string> implements Named {
  name: any;
}

export declare class FromHidden {}

export type ModuleClassExtendsProps = Record<string, never>;

export type ModuleClassExtendsExports = Record<string, never>;

declare const ModuleClassExtends: Component<
  ModuleClassExtendsProps,
  ModuleClassExtendsExports,
  ""
>;
export default ModuleClassExtends;
