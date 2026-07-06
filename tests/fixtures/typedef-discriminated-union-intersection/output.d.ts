import { SvelteComponentTyped } from "svelte";

export interface Base {
  id: string;
  createdAt: number
}

export type User = Base & { kind: "user"; name: string };

export type Post = Base & { kind: "post"; title: string; body: string };

export type Entity = User | Post;

export type TypedefDiscriminatedUnionIntersectionProps = {
  /**
   * @default { id: "1", createdAt: 0, kind: "user", name: "Ada" }
   */
  entity?: Entity;
};

export default class TypedefDiscriminatedUnionIntersection extends SvelteComponentTyped<
  TypedefDiscriminatedUnionIntersectionProps,
  Record<string, any>,
  Record<string, never>
> {}
