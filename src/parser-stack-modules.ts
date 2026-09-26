/**
 * Everything that needs the parser stack (acorn, `@sveltejs/acorn-typescript`,
 * the template parser, the JSDoc parser), loaded as one lazy chunk by
 * {@link loadParserStack}. Modules outside it reach these only through
 * `getParserStack()`, so a fully cached run never evaluates them.
 */
export { default as ComponentParser } from "./ComponentParser";
export { deriveLiteralDetailType, literalDetailToTypeText } from "./parser/events";
export { extractJsDocDeprecatedAndTags, extractJsDocReturnType, getCommentTags } from "./parser/jsdoc";
export { parse as parseSvelte } from "./svelte-template-parse";
export { parseProgram } from "./template-parse/acorn-bridge";
