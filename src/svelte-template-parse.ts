import { type AST, parseSections } from "svelte-ast";
import { createParser } from "svelte-ast/core";
import { typescript } from "svelte-ast/typescript";

// Without svelte-ast/entities, named character references other than
// `&amp;`, `&lt;`, `&gt;`, `&quot;` and `&apos;` (such as `&copy;`) stay as
// written in text. sveld only reads text in `<slot name>` and `<script>`
// attributes, and the table is about 9 kB gzip of browser bundles.
const { parse: parseComponent } = createParser({ typescript });

/** `<style>` isn't parsed: sveld only reads its bounds. */
export function parse(source: string): AST.Root {
  return parseComponent(source, { css: false });
}

/**
 * Parses only a component's top-level `<script>`s (and `<style>` and
 * `<svelte:options>` bounds): `fragment` is empty, so the markup is skipped
 * rather than parsed. Offsets are the same as {@link parse}'s.
 */
export function parseScripts(source: string): AST.Root {
  return parseSections(source, { css: false });
}
