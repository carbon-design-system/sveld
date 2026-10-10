/**
 * Parse phase 1: parse the source and read everything the walks need up
 * front (script language, type annotations, hoisted bindings, and the
 * component-level JSDoc tags).
 */
import { lexComponent } from "sveast";
import { parse as parseModernAst } from "../svelte-template-parse";
import { parseCustomTypes } from "./component-tags";
import type { ParserContext } from "./context";
import { detectSyntaxMode } from "./runes-detection";
import { buildRunesPropTypeMetadata } from "./runes-props";
import { stripTypeCastWrappers } from "./typescript-casts";
import { collectHoistedScriptBindings } from "./value-imports";

/** A `// @ts-...` comment, but not one on a `*` line of a JSDoc block (e.g. in an `@example`). */
const TS_DIRECTIVE_REGEX = /\/\/(?<!^[ \t]*\*.*\/\/)\s*@ts-[^\n\r]*/gm;

/**
 * Removes `// @ts-...` directives from the top-level `<script>`s only;
 * `lexComponent` finds those the way the parser does.
 */
function stripTypeScriptDirectivesFromScripts(source: string): string {
  if (!source.includes("@ts-")) return source;

  // lexComponent's offsets, like parse's, don't count a leading byte order mark.
  const bom = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  const { instance, module } = lexComponent(source);
  const scripts = [instance, module]
    .flatMap((script) => (script ? [script.content] : []))
    .sort((a, b) => a.start - b.start);

  let cleaned = "";
  let last = 0;
  for (const { start, end } of scripts) {
    cleaned += source.slice(last, start + bom);
    cleaned += source.slice(start + bom, end + bom).replace(TS_DIRECTIVE_REGEX, "");
    last = end + bom;
  }
  return cleaned + source.slice(last);
}

/** Parses `source` into a fresh `ctx` and collects what the walks read up front. */
export function prepareComponent(ctx: ParserContext, source: string, filePath: string): void {
  ctx.componentFilePath = filePath;
  const cleanedSource = stripTypeScriptDirectivesFromScripts(source);
  ctx.source = cleanedSource;

  const parsed = parseModernAst(cleanedSource);
  buildRunesPropTypeMetadata(ctx, parsed);
  ctx.parsed = parsed;

  // svelte's compile() strips TS-only wrappers (`as`, `satisfies`, `!`, ...); parse() leaves them.
  if (ctx.scriptLanguage === "ts") {
    stripTypeCastWrappers(parsed.module, ctx.typeCasts);
    stripTypeCastWrappers(parsed.instance, ctx.typeCasts);
    stripTypeCastWrappers(parsed.fragment, ctx.typeCasts);
  }

  ctx.syntaxMode = detectSyntaxMode(ctx);

  // `parseCustomTypes` scans raw text, so a `/** */` comment in `<style>` would read as
  // JSDoc. Blank the style block out (same length, so offsets don't move) for that scan only.
  const cssBlock = parsed.css;
  const scanSource = cssBlock
    ? cleanedSource.slice(0, cssBlock.start) +
      " ".repeat(cssBlock.end - cssBlock.start) +
      cleanedSource.slice(cssBlock.end)
    : cleanedSource;

  // `parseCustomTypes` needs `ctx.funcDecls` to tell a function's `@template` from a component generic.
  collectHoistedScriptBindings(ctx, parsed.module);
  collectHoistedScriptBindings(ctx, parsed.instance);

  parseCustomTypes(ctx, scanSource);
}
