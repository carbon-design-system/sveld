/**
 * The Svelte version sveld was built against, in its own module so callers
 * that only need it for a cache key or document metadata (`parse-cache.ts`,
 * `writer/document-model.ts`) don't have to import the parser stack
 * (`./svelte-parse`) to get it.
 *
 * Svelte is a devDependency only (sveld bundles its own parser and doesn't
 * require consumers to have Svelte installed), so this reads the version via
 * the bare `svelte/package.json` specifier rather than a path into
 * `node_modules` - that resolves correctly through Svelte's own `exports`
 * map regardless of install topology (pnpm, workspaces, Yarn PnP), and gets
 * inlined to a plain string at sveld's own build time either way.
 */
export { version as VERSION } from "svelte/package.json";
