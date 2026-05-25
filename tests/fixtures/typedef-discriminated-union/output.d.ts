import { SvelteComponentTyped } from "svelte";

export type Result = { kind: "success"; value: string } | { kind: "error"; error: Error };

export type Status = { ok: true; data: number } | { ok: false; reason: string } | "pending";

export type TypedefDiscriminatedUnionProps = {
  /**
   * @default { kind: "success", value: "ok" }
   */
  result?: Result;

  /**
   * @default "pending"
   */
  status?: Status;
};

export default class TypedefDiscriminatedUnion extends SvelteComponentTyped<
  TypedefDiscriminatedUnionProps,
  Record<string, any>,
  Record<string, never>
> {}
