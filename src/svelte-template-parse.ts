import type { AST } from "sveast";
import { parse as parseComponent } from "sveast";

/**
 * Parses a component with sveast, which produces svelte/compiler's modern
 * AST. `<style>` isn't parsed: sveld only reads its bounds.
 */
export function parse(source: string): AST.Root {
  return parseComponent(source, { css: false });
}
