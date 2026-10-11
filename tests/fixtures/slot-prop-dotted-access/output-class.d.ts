import { SvelteComponentTyped } from "svelte";

export type SlotPropDottedAccessProps = {
  /**
   * @default { x: 0, y: 0 }
   */
  point?: {
    x: number;
    y: number
  };

  /**
   * @default { onClick: () => {}, label: "" }
   */
  item?: {
    onClick: (e: MouseEvent) => void;
    label: string
  };

  /** A `@slot` type wins over the type a dotted access would resolve to. */
  typed?: (this: void, ...args: [{ item: "override" }]) => void;

  children?: (this: void, ...args: [{
        a: string;
        b: string;
        c: number;
        d: string | undefined;
        e: "pending" | "done" | "error";
        f: { deep: number };
        g: Array<string>;
        h: any;
        i: number;
        j: string;
        k: string;
        computed: any;
        chained: any;
      }]) => void;
};

export default class SlotPropDottedAccess extends SvelteComponentTyped<
  SlotPropDottedAccessProps,
  Record<string, any>,
  {
    default: {
      a: string;
      b: string;
      c: number;
      d: string | undefined;
      e: "pending" | "done" | "error";
      f: { deep: number };
      g: Array<string>;
      h: any;
      i: number;
      j: string;
      k: string;
      computed: any;
      chained: any;
    };
    /** A `@slot` type wins over the type a dotted access would resolve to. */
    typed: { item: "override" };
  }
> {}
