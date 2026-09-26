/**
 * Parse phase 1: parse the source and read everything the walks need up
 * front (script language, type annotations, hoisted bindings, and the
 * component-level JSDoc tags).
 */
import { parse as parseModernAst } from "../svelte-template-parse";
import { parseCustomTypes } from "./component-tags";
import type { ParserContext } from "./context";
import { detectSyntaxMode } from "./runes-detection";
import { buildRunesPropTypeMetadata } from "./runes-props";
import { stripTypeCastWrappers } from "./typescript-casts";
import { collectHoistedScriptBindings } from "./value-imports";

const SCRIPT_BLOCK_REGEX = /(<script[^>]*>)([\s\S]*?)(<\/script>)/gi;

/** A `// @ts-...` comment, but not one on a `*` line of a JSDoc block (e.g. in an `@example`). */
const TS_DIRECTIVE_REGEX = /\/\/(?<!^[ \t]*\*.*\/\/)\s*@ts-[^\n\r]*/gm;

function stripTypeScriptDirectivesFromScripts(source: string): string {
  // Every directive contains `@ts-`; without it there's nothing to strip,
  // so skip the script-block regex replace (and the source copy it makes).
  if (!source.includes("@ts-")) return source;

  SCRIPT_BLOCK_REGEX.lastIndex = 0;
  return source.replace(SCRIPT_BLOCK_REGEX, (_match, openTag, scriptContent, closeTag) => {
    TS_DIRECTIVE_REGEX.lastIndex = 0;
    const cleanedContent = scriptContent.replace(TS_DIRECTIVE_REGEX, "");
    return openTag + cleanedContent + closeTag;
  });
}

/** Parses `source` into a fresh `ctx` and collects what the module and component walks read. */
export function prepareComponent(ctx: ParserContext, source: string, filePath: string): void {
  ctx.componentFilePath = filePath;
  const cleanedSource = stripTypeScriptDirectivesFromScripts(source);
  ctx.source = cleanedSource;

  /**
   * One modern-AST parse feeds both `buildRunesPropTypeMetadata` and the
   * main walk. There's no conversion step in between, so order doesn't matter.
   */
  const parsed = parseModernAst(cleanedSource);
  buildRunesPropTypeMetadata(ctx, parsed);
  ctx.parsed = parsed;

  /**
   * compile() strips TS-only wrapper expressions (`as`/`satisfies`/`!`/type assertions/explicit
   * generic instantiation) before exposing its AST; parse() alone leaves them in place. Only
   * TS-tagged scripts can contain them, so skip the walk entirely for plain JS components.
   */
  if (ctx.scriptLanguage === "ts") {
    stripTypeCastWrappers(parsed.module);
    stripTypeCastWrappers(parsed.instance);
    stripTypeCastWrappers(parsed.fragment);
  }

  ctx.syntaxMode = detectSyntaxMode(ctx);

  /**
   * `parseCustomTypes` scans the raw source text for `/** *\/`-style comment blocks
   * (via `comment-parser`), which has no notion of Svelte's markup structure - a
   * `/** ... *\/`-shaped comment inside a top-level `<style>` block would otherwise be
   * misread as a JSDoc block and could produce a spurious typedef/event/etc. Blank out
   * the style block's own text (same length, so it doesn't shift any offsets) for this
   * scan only; `ctx.source` itself stays the untouched parsed source so every other
   * offset computation (source ranges, `sourceAtPos`, ...) is unaffected.
   */
  const cssBlock = parsed.css;
  const scanSource = cssBlock
    ? cleanedSource.slice(0, cssBlock.start) +
      " ".repeat(cssBlock.end - cssBlock.start) +
      cleanedSource.slice(cssBlock.end)
    : cleanedSource;

  /**
   * Imports and function declarations hoist, so `export let id = uniqueId()` must
   * resolve even when the import or `function uniqueId()` comes later in the script
   * (see #410) - and `parseCustomTypes` below needs `ctx.funcDecls` populated too, to
   * tell a `@template` tag documenting an ordinary function apart from one declaring a
   * component generic (see `blockDocumentsFunction` in `parser/component-tags.ts`).
   *
   * Skip the template. Imports and function declarations never appear in the template
   * fragment, so walking markup here would re-traverse the largest part of the AST for nothing.
   */
  collectHoistedScriptBindings(ctx, parsed.module);
  collectHoistedScriptBindings(ctx, parsed.instance);

  parseCustomTypes(ctx, scanSource);
}
