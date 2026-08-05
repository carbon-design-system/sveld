import { SvelteComponentTyped } from "svelte";

export type AsyncFunctionPropsProps = {
  /**
   * @default async (id) => id > 0
   */
  validate?: (id: number) => Promise<boolean>;
};

export default class AsyncFunctionProps extends SvelteComponentTyped<
  AsyncFunctionPropsProps,
  Record<string, any>,
  Record<string, never>
> {
  initialize: () => Promise<void>;

  fetchData: (url: string) => Promise<Response>;
}
