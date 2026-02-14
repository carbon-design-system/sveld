import { SvelteComponentTyped } from "svelte";

export type SlotPropDottedAccessProps = {
  /**
   * @default { x: 0, y: 0 }
   */
  point?: { x: number; y: number };

  children?: (
    this: void,
    ...args: [
      {
        a: string;
        b: string;
        c: number;
        d: string;
        e: "pending" | "done" | "error";
        f: { deep: number };
        g: Array<string>;
        h: any;
        i: number;
      },
    ]
  ) => void;
};

export default class SlotPropDottedAccess extends SvelteComponentTyped<
  SlotPropDottedAccessProps,
  Record<string, any>,
  {
    default: {
      a: string;
      b: string;
      c: number;
      d: string;
      e: "pending" | "done" | "error";
      f: { deep: number };
      g: Array<string>;
      h: any;
      i: number;
    };
  }
> {}
