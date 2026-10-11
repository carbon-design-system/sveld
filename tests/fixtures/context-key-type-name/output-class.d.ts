import { SvelteComponentTyped } from "svelte";

export type CarbonModalContext = {
  /** Open the modal */
  open: () => void;
};

export type MyContextContext = {
  /** Open the modal */
  open: () => void;
};

export type AppDataTableV2Context = {
  /** Open the modal */
  open: () => void;
};

export type ScopeCtxContext = {
  count: number;
};

export type _123Context = {
  count: number;
};

export type MyKeyContext = {
  count: number;
};

export type SimpleModalContext = {
  /** Open the modal */
  open: () => void;
};

export type TabsContext = {
  count: number;
};

export type TemplateKeyContext = {
  count: number;
};

export type ContextKeyTypeNameProps = Record<string, never>;

export default class ContextKeyTypeName extends SvelteComponentTyped<
  ContextKeyTypeNameProps,
  Record<string, any>,
  Record<string, never>
> {}
