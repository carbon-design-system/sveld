import { SvelteComponentTyped } from "svelte";

export interface Options {
  id: string;
  size: "sm" | "md" | "lg";
  disabled: boolean
}

export type Factory = () => Options;

export type UserId = string & { readonly __brand: "UserId" };

export interface User {
  id: string;
  name: string
}

export type UserGuard = (value: unknown) => value is User;

export type TypedefTypeTextVerbatimProps = {
  summary: Pick<Options, "id" | "size">;

  editable: Omit<Options, "disabled">;

  defaults: ReturnType<Factory>;

  resolved: Awaited<Promise<Options>>;

  userId: UserId;

  isUser: (value: unknown) => value is User;

  validate: UserGuard;

  payload: unknown;

  raw: any;
};

export default class TypedefTypeTextVerbatim extends SvelteComponentTyped<
  TypedefTypeTextVerbatimProps,
  Record<string, any>,
  Record<string, never>
> {}
