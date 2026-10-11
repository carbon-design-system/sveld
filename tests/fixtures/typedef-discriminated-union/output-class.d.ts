import { SvelteComponentTyped } from "svelte";

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

export interface Base {
  id: string;
  createdAt: number
}

export type User = Base & {
  kind: "user";
  name: string
};

export type Post = Base & {
  kind: "post";
  title: string;
  body: string
};

export type Entity = User | Post;

export type TypedefDiscriminatedUnionProps = {
  /**
   * @default { kind: "success", value: "ok" }
   */
  result?: Result;

  /**
   * @default "pending"
   */
  status?: Status;

  /**
   * @default { id: "1", createdAt: 0, kind: "user", name: "Ada" }
   */
  entity?: Entity;
};

export default class TypedefDiscriminatedUnion extends SvelteComponentTyped<
  TypedefDiscriminatedUnionProps,
  Record<string, any>,
  Record<string, never>
> {}
