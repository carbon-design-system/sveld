import type { ComponentGenerics } from "../ComponentParser";
import type { ParserContext } from "./context";
import { collectReferencedTypeDependencies } from "./type-resolution";

const LEADING_IDENTIFIER_REGEX = /^[A-Za-z_$][\w$]*/;
const IDENTIFIER_REGEX = /[A-Za-z_$][\w$]*/g;
const LEADING_TYPE_PARAM_MODIFIER_REGEX = /^(?:const|in|out)\s+/;

/**
 * Splits a string on top-level commas, ignoring commas nested inside
 * `<>`, `()`, `[]`, `{}`, or a string literal. Shared by the `generics`
 * script attribute parser and the TypeScript definition writer, both of
 * which must separate generic constraint declarations that may themselves
 * contain commas (e.g. `Value extends Record<string, any>`). The `>` of an
 * arrow (`=>`) doesn't close a bracket.
 */
export function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '"' || char === "'" || char === "`") {
      i = skipStringLiteral(value, i);
    } else if (char === "<" || char === "(" || char === "[" || char === "{") depth++;
    else if (char === ">" && value[i - 1] === "=") continue;
    else if (char === ">" || char === ")" || char === "]" || char === "}") depth = Math.max(depth - 1, 0);
    else if (char === "," && depth === 0) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }

  parts.push(value.slice(start));
  return parts;
}

/** Index of the quote closing the string literal that opens at `start`, or the last index if unclosed. */
function skipStringLiteral(value: string, start: number): number {
  const quote = value[start];
  for (let i = start + 1; i < value.length; i++) {
    if (value[i] === "\\") i++;
    else if (value[i] === quote) return i;
  }
  return value.length - 1;
}

/**
 * Parses the `generics` script attribute value (a TypeScript type-parameter
 * list, e.g. `"Row extends DataTableRow = DataTableRow, Header"`) into the
 * same `[names, constraints]` tuple the `@generics`/`@template` JSDoc tags produce.
 */
export function parseGenericsAttribute(value: string): ComponentGenerics {
  const constraints = splitTopLevelCommas(value)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (constraints.length === 0) return null;

  const names = constraints.map((constraint) => {
    let usageSite = constraint;
    while (LEADING_TYPE_PARAM_MODIFIER_REGEX.test(usageSite)) {
      usageSite = usageSite.replace(LEADING_TYPE_PARAM_MODIFIER_REGEX, "");
    }
    return usageSite.match(LEADING_IDENTIFIER_REGEX)?.[0] ?? constraint;
  });

  return [names.join(", "), constraints.join(", ")];
}

/**
 * Extends `referencedImportedTypes`/`referencedLocalTypes` with any type names
 * mentioned in the `generics` script attribute (e.g. the `DataTableRow` in
 * `Row extends DataTableRow = DataTableRow`). These names only appear in the
 * raw attribute string, not in the `$props()` type annotation AST that
 * {@link collectReferencedTypeDependencies} normally walks, so without this
 * they would never get hoisted into the emitted `.d.ts`.
 */
export function collectGenericsAttributeTypeDependencies(
  ctx: ParserContext,
  referencedImportedTypes: Set<string>,
  referencedLocalTypes: Set<string>,
) {
  const value = ctx.scriptGenericsAttribute?.value;
  if (!value) return;

  for (const [name] of value.matchAll(IDENTIFIER_REGEX)) {
    if (ctx.typeImportBindingsByLocalName.has(name)) {
      referencedImportedTypes.add(name);
    }

    if (referencedLocalTypes.has(name)) continue;
    const localDeclaration = ctx.localTypeDeclarationsByName.get(name);
    if (!localDeclaration) continue;

    referencedLocalTypes.add(name);
    collectReferencedTypeDependencies(ctx, localDeclaration.node, referencedImportedTypes, referencedLocalTypes);
  }
}
