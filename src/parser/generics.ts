import type { ComponentGenerics } from "../ComponentParser";
import type { ParserContext } from "./context";
import { splitTopLevelCommas } from "./split-top-level";
import { collectReferencedTypeDependencies } from "./type-resolution";

const LEADING_IDENTIFIER_REGEX = /^[A-Za-z_$][\w$]*/;
const IDENTIFIER_REGEX = /[A-Za-z_$][\w$]*/g;
const LEADING_TYPE_PARAM_MODIFIER_REGEX = /^(?:const|in|out)\s+/;

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
