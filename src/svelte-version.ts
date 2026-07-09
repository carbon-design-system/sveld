/**
 * The installed Svelte version, in its own module so callers that only need
 * it for a cache key or document metadata (`parse-cache.ts`,
 * `writer/document-model.ts`) don't have to import the parser stack
 * (`./svelte-parse`) to get it.
 */
// @ts-expect-error - internal svelte module, no published types
import { VERSION as VERSION_RAW } from "../node_modules/svelte/src/version.js";

export const VERSION: string = VERSION_RAW;
