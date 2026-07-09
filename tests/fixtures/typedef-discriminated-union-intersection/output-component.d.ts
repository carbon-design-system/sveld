import type { Component } from "svelte";

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

export type TypedefDiscriminatedUnionIntersectionProps = {
  /**
   * @default { id: "1", createdAt: 0, kind: "user", name: "Ada" }
   */
  entity?: Entity;
};

export type TypedefDiscriminatedUnionIntersectionExports = Record<string, never>;

declare const TypedefDiscriminatedUnionIntersection: Component<
  TypedefDiscriminatedUnionIntersectionProps,
  TypedefDiscriminatedUnionIntersectionExports,
  ""
>;
export default TypedefDiscriminatedUnionIntersection;
