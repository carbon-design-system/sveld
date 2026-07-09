import type { Component } from "svelte";

export type Result = {
  kind: "success";
  value: string
} | {
  kind: "error";
  error: Error
};

export type Status = {
  ok: true;
  data: number
} | {
  ok: false;
  reason: string
} | "pending";

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

export type TypedefDiscriminatedUnionExports = Record<string, never>;

declare const TypedefDiscriminatedUnion: Component<
  TypedefDiscriminatedUnionProps,
  TypedefDiscriminatedUnionExports,
  ""
>;
export default TypedefDiscriminatedUnion;
