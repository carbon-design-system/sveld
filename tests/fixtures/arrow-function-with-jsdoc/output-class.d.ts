import { SvelteComponentTyped } from "svelte";

export type ArrowFunctionWithJsdocProps = {
  transform?: (value: string, options?: { uppercase?: boolean }) => string;

  processItems?: (items: string[], callback: (item: string, index: number) => void) => Promise<void>;

  /**
   * @default (id) => ({ id, created: new Date() })
   */
  createRecord?: (id: string) => {
    id: string;
    created: Date
  };
};

export default class ArrowFunctionWithJsdoc extends SvelteComponentTyped<
  ArrowFunctionWithJsdocProps,
  Record<string, any>,
  Record<string, never>
> {}
