import { SvelteComponentTyped } from "svelte";

export interface User {
  id: string;
  name: string
}

/**
 * A type guard expressed as a `@callback`.
 */
export type UserGuard = (value: unknown) => value is User;

export type TypedefTypePredicateProps = {
  /**
   * A type guard. It accepts an `unknown` value and returns a type predicate,
   * so callers can narrow `unknown` to `User` before accessing its fields.
   * @default undefined
   */
  isUser: (value: unknown) => value is User;

  /**
   * A type guard expressed as a `@callback`.
   * @default undefined
   */
  validate: UserGuard;
};

export default class TypedefTypePredicate extends SvelteComponentTyped<
  TypedefTypePredicateProps,
  Record<string, any>,
  Record<string, never>
> {}
