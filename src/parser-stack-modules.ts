/**
 * Everything that needs the parser stack (svelte-ast, the JSDoc parser),
 * loaded as one lazy chunk by {@link loadParserStack}. Modules outside it
 * reach these only through `getParserStack()`, so a fully cached run never
 * evaluates them.
 */
export { parseModule } from "svelte-ast";
export { default as ComponentParser } from "./ComponentParser";
export { formatParseError } from "./parse-error";
export { deriveLiteralDetailType, literalDetailToTypeText } from "./parser/events";
export { extractJsDocDeprecatedAndTags, extractJsDocReturnType, extractJsDocType } from "./parser/jsdoc";
export { parse as parseSvelte, parseScripts as parseSvelteScripts } from "./svelte-template-parse";
