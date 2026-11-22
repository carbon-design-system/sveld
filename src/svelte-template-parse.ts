import type { AST } from "svelte-ast";
import { createParser, createSectionsParser } from "svelte-ast/core";
import { typescript } from "svelte-ast/typescript";

// Without svelte-ast/entities, named character references other than
// `&amp;`, `&lt;`, `&gt;`, `&quot;` and `&apos;` (such as `&copy;`) stay as
// written in text. sveld only reads text in `<slot name>` and `<script>`
// attributes, and the table is about 9 kB gzip. Both parsers are created on
// first use, so a bundle that never parses a template (the writers alone)
// can drop them.
let parseComponent: ReturnType<typeof createParser>["parse"] | undefined;
let parseComponentSections: ReturnType<typeof createSectionsParser>["parseSections"] | undefined;

/** `<style>` isn't parsed: sveld only reads its bounds. */
export function parse(source: string): AST.Root {
  parseComponent ??= createParser({ typescript }).parse;
  return parseComponent(source, { css: false });
}

/**
 * Parses only a component's top-level `<script>`s (and `<style>` and
 * `<svelte:options>` bounds): `fragment` is empty, so the markup is skipped
 * rather than parsed. Offsets are the same as {@link parse}'s.
 */
export function parseScripts(source: string): AST.Root {
  parseComponentSections ??= createSectionsParser({ typescript }).parseSections;
  return parseComponentSections(source, { css: false });
}
