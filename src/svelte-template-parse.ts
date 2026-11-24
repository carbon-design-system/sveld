import type { AST } from "svelte-ast";
import { createParser, createSectionsParser } from "svelte-ast/core";
import { typescript } from "svelte-ast/typescript";

// Without svelte-ast/entities, named character references other than
// `&amp;`, `&lt;`, `&gt;`, `&quot;` and `&apos;` (such as `&copy;`) stay
// as written in text. sveld only reads text in `<slot name>` and
// `<script>` attributes, and the table is about 9 kB gzip. Both parsers
// are created on first use, so a bundle that never parses a template (the
// writers alone) can drop them.
let componentParser: ReturnType<typeof createParser> | undefined;
let sectionsParser: ReturnType<typeof createSectionsParser> | undefined;

// `<style>` isn't parsed, since sveld only reads its bounds.
export function parse(source: string): AST.Root {
  componentParser ??= createParser({ typescript });
  return componentParser.parse(source, { css: false });
}

// `fragment` is empty, so the markup is skipped rather than parsed;
// `<style>` and `<svelte:options>` only get bounds. Offsets are the same
// as `parse`'s.
export function parseScripts(source: string): AST.Root {
  sectionsParser ??= createSectionsParser({ typescript });
  return sectionsParser.parseSections(source, { css: false });
}
