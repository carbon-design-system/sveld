/// <reference types="vite/client" />

declare module "virtual:default-parsed" {
  /** The first example in `data.ts`, parsed at build time; `null` on the dev server. */
  const parsed: Record<string, unknown> | null;
  export default parsed;
}

declare module "virtual:examples-parsed" {
  /** The other examples that survive serialization, parsed at build time; `null` on the dev server. */
  const parsed: Record<string, Record<string, unknown>> | null;
  export default parsed;
}
