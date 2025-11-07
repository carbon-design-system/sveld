import type { SvelteComponentTyped } from "svelte";

export type User = {
  /** The user's full name. */ name: string;
  /** The user's email address. */ email: string;
  /** The user's age in years. */ age: number;
};

export type ComponentConfig = {
  /** Whether the component is enabled. */ enabled: boolean;
  /** The component theme. */ theme: string;
};

export interface SimpleType {
  id: number;
  label: string;
}

export type TypedefJsdocPropertiesProps = {
  /**
   * Represents a user in the system.
   * @default { name: "John", email: "john@example.com", age: 30 }
   */
  user?: User;

  /**
   * Configuration options for the component.
   * @default { enabled: true, theme: "dark" }
   */
  config?: ComponentConfig;

  /**
   * Simple typedef without properties (backwards compatibility test).
   * @default { id: 1, label: "Test" }
   */
  simple?: SimpleType;
};

export default class TypedefJsdocProperties extends SvelteComponentTyped<
  TypedefJsdocPropertiesProps,
  Record<string, any>,
  Record<string, never>
> {}
