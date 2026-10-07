import type { ComponentGenerics } from "../model";
import { splitTopLevel } from "../type-text";
import type { ParserContext } from "./context";
import { collectReferencedTypeDependencies } from "./type-resolution";

const LEADING_IDENTIFIER_REGEX = /^[A-Za-z_$][\w$]*/;
const IDENTIFIER_REGEX = /[A-Za-z_$][\w$]*/g;
const LEADING_TYPE_PARAM_MODIFIERS_REGEX = /^(?:(?:const|in|out)\s+)+/;

/**
 * Parses the `generics` script attribute value (a TypeScript type-parameter
 * list, e.g. `"Row extends DataTableRow = DataTableRow, Header"`) into the
 * same `[names, constraints]` tuple the `@generics`/`@template` JSDoc tags produce.
 */
export function parseGenericsAttribute(value: string): ComponentGenerics {
  const constraints = splitTopLevel(value, ",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (constraints.length === 0) return null;

  const names = constraints.map(
    (constraint) =>
      constraint.replace(LEADING_TYPE_PARAM_MODIFIERS_REGEX, "").match(LEADING_IDENTIFIER_REGEX)?.[0] ?? constraint,
  );

  return [names.join(", "), constraints.join(", ")];
}

/**
 * Type names in the `generics` attribute (`DataTableRow` in `Row extends
 * DataTableRow`) exist only as raw text, not in any AST
 * {@link collectReferencedTypeDependencies} walks, so they're matched here.
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

export function accumulateGeneric(ctx: ParserContext, name: string, constraint: string): void {
  if (ctx.generics) {
    ctx.generics = [`${ctx.generics[0]}, ${name}`, `${ctx.generics[1]}, ${constraint}`];
  } else {
    ctx.generics = [name, constraint];
  }
}
