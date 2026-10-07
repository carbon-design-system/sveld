import { type AST, parse as parseComponent, parseSections } from "sveast";

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
