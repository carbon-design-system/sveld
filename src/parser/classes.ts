import type {
  ClassDeclaration,
  ClassExpression,
  EntityName,
  MethodDefinition,
  PropertyDefinition,
  Statement,
  TSTypeParameterInstantiation,
} from "svelte-ast";
import type { ComponentClassMember, ComponentPropParam } from "../model";
import type { ParserContext } from "./context";
import { processNodeJSDoc } from "./jsdoc";
import { literalType } from "./props";
import {
  getTypeAnnotationText,
  getTypeNodeText,
  readFunctionDeclarationParts,
  trackAdditionalTypeDependencyNode,
} from "./type-resolution";

type ClassDeclarationLike = ClassDeclaration | ClassExpression;

type ClassMemberNode = MethodDefinition | PropertyDefinition;

type MemberJSDoc = ReturnType<typeof processNodeJSDoc>;

// A `#private` key is a PrivateIdentifier, so it gets no name either.
function memberName(member: ClassMemberNode): string | undefined {
  if (member.computed) return undefined;
  if (member.key.type === "Identifier") return member.key.name;
  if (member.key.type === "Literal" && (typeof member.key.value === "string" || typeof member.key.value === "number")) {
    return String(member.key.value);
  }
  return undefined;
}

function isHidden(accessibility: string | undefined): boolean {
  return accessibility === "private" || accessibility === "protected";
}

function memberDocs(jsdoc: MemberJSDoc): Pick<ComponentClassMember, "description" | "deprecated" | "tags"> {
  return {
    ...(jsdoc?.description ? { description: jsdoc.description } : {}),
    ...(jsdoc?.deprecated === undefined ? {} : { deprecated: jsdoc.deprecated }),
    ...(jsdoc?.tags ? { tags: jsdoc.tags } : {}),
  };
}

function stripAngleBrackets(typeParameters: string | undefined): string | undefined {
  return typeParameters?.slice(1, -1).trim() || undefined;
}

function defaultValueType(rawParam: MethodDefinition["value"]["params"][number] | undefined): string | undefined {
  const param = rawParam?.type === "TSParameterProperty" ? rawParam.parameter : rawParam;
  return param?.type === "AssignmentPattern" ? literalType(param.right, "widen") : undefined;
}

// Each part comes from its TypeScript annotation, else its JSDoc tag,
// else its literal default, else `any`.
function readMethodSignature(
  ctx: ParserContext,
  fn: MethodDefinition["value"],
  jsdoc: MemberJSDoc,
): Pick<ComponentClassMember, "params" | "returnType" | "typeParameters"> {
  const parts = readFunctionDeclarationParts(ctx, fn);
  const jsdocParams = new Map((jsdoc?.params ?? []).map((param) => [param.name, param]));
  const params = parts.params.map(({ name, type, optional, rest }, index): ComponentPropParam => {
    const doc = jsdocParams.get(name);
    return {
      name: rest ? `...${name}` : name,
      type: type ?? doc?.type ?? defaultValueType(fn.params[index]) ?? (rest ? "any[]" : "any"),
      ...(doc?.description ? { description: doc.description } : {}),
      ...(!rest && (optional || doc?.optional) ? { optional: true } : {}),
    };
  });
  const returnType = parts.returnType ?? jsdoc?.returnType ?? (fn.async ? "Promise<any>" : undefined);
  const typeParameters = stripAngleBrackets(parts.typeParameters) ?? jsdoc?.typeParameters;
  return {
    ...(params.length > 0 ? { params } : {}),
    ...(returnType ? { returnType } : {}),
    ...(typeParameters ? { typeParameters } : {}),
  };
}

// Only public members, in source order: never `#x`, `private`,
// `protected`, computed-key, or `@internal`/`@ignore` ones. An
// overloaded method keeps only its overload signatures.
export function readClassDeclaration(
  ctx: ParserContext,
  classDecl: ClassDeclarationLike,
): { members: ComponentClassMember[]; typeParameters?: string; extends?: string; implements?: string[] } {
  const members: ComponentClassMember[] = [];
  // Keyed `static name` or `name`, so a getter and its setter merge into
  // one property.
  const accessors = new Map<string, ComponentClassMember>();
  // Only the overload signatures of these methods ship, not the
  // implementation behind them.
  const overloaded = new Set<string>();
  const instanceProperties = new Set<string>();
  let constructorBody: Statement[] | undefined;
  let constructorIndex = -1;

  for (const member of classDecl.body.body) {
    if (member.type === "TSIndexSignature") {
      const [parameter] = member.parameters;
      if (!parameter) continue;
      trackAdditionalTypeDependencyNode(ctx, member.typeAnnotation?.typeAnnotation);
      members.push({
        kind: "index",
        name: `[${parameter.name}: ${getTypeAnnotationText(ctx, parameter.typeAnnotation) ?? "string"}]`,
        type: getTypeAnnotationText(ctx, member.typeAnnotation) ?? "any",
        ...(member.static ? { static: true as const } : {}),
        ...(member.readonly ? { readonly: true as const } : {}),
      });
      continue;
    }
    if (member.type !== "MethodDefinition" && member.type !== "PropertyDefinition") continue;
    if (isHidden(member.accessibility)) continue;
    const name = memberName(member);
    if (name === undefined) continue;
    const jsdoc = processNodeJSDoc(ctx, member);
    if (jsdoc?.internal) continue;

    const key = `${member.static ? "static " : ""}${name}`;
    const modifiers: Pick<ComponentClassMember, "static" | "optional" | "abstract"> = {
      ...(member.static ? { static: true as const } : {}),
      ...(member.optional ? { optional: true as const } : {}),
      ...(member.abstract ? { abstract: true as const } : {}),
    };

    if (member.type !== "MethodDefinition") {
      trackAdditionalTypeDependencyNode(ctx, member.typeAnnotation?.typeAnnotation);
      if (!member.static) instanceProperties.add(name);
      members.push({
        kind: "property",
        name,
        type:
          getTypeAnnotationText(ctx, member.typeAnnotation) ??
          jsdoc?.type ??
          literalType(member.value, "widen") ??
          "any",
        ...modifiers,
        ...(member.readonly ? { readonly: true as const } : {}),
        ...memberDocs(jsdoc),
      });
      continue;
    }

    // A method's own `<U>` is on the method, not its function value, so it's
    // copied onto the value.
    const fn = member.typeParameters ? { ...member.value, typeParameters: member.typeParameters } : member.value;

    if (member.kind === "constructor") {
      const signature = readMethodSignature(ctx, fn, jsdoc);
      members.push({ kind: "constructor", name: "constructor", params: signature.params, ...memberDocs(jsdoc) });
      constructorIndex = members.length;
      constructorBody = fn.type === "FunctionExpression" ? fn.body.body : undefined;
      // `constructor(public x: T)` also declares a property `x`.
      for (const [index, param] of fn.params.entries()) {
        if (param.type !== "TSParameterProperty" || isHidden(param.accessibility)) continue;
        const signatureParam = signature.params?.[index];
        if (!signatureParam) continue;
        instanceProperties.add(signatureParam.name);
        members.push({
          kind: "property",
          name: signatureParam.name,
          type: signatureParam.type,
          ...(param.readonly ? { readonly: true as const } : {}),
          ...(signatureParam.description ? { description: signatureParam.description } : {}),
        });
      }
      continue;
    }

    if (member.kind === "get" || member.kind === "set") {
      const signature = readMethodSignature(ctx, fn, jsdoc);
      const type =
        member.kind === "get" ? (signature.returnType ?? jsdoc?.type) : (signature.params?.[0]?.type ?? jsdoc?.type);
      const existing = accessors.get(key);
      if (existing) {
        // A setter makes the getter's property writable.
        if (member.kind === "set") existing.readonly = undefined;
        if (type && type !== "any" && (existing.type === "any" || member.kind === "get")) existing.type = type;
        if (!existing.description && !existing.deprecated) Object.assign(existing, memberDocs(jsdoc));
        continue;
      }
      const property: ComponentClassMember = {
        kind: "property",
        name,
        type: type ?? "any",
        ...modifiers,
        ...(member.kind === "get" ? { readonly: true as const } : {}),
        ...memberDocs(jsdoc),
      };
      accessors.set(key, property);
      members.push(property);
      continue;
    }

    // `f(a: string): void;` with no body: an overload signature (or an
    // abstract method).
    if (fn.type === "TSDeclareMethod" && !member.abstract) overloaded.add(key);
    else if (fn.type !== "TSDeclareMethod" && overloaded.has(key)) continue;
    members.push({ kind: "method", name, ...modifiers, ...readMethodSignature(ctx, fn, jsdoc), ...memberDocs(jsdoc) });
  }

  if (ctx.scriptLanguage !== "ts" && constructorBody) {
    members.splice(constructorIndex, 0, ...readConstructorAssignments(ctx, constructorBody, instanceProperties));
  }

  for (const typeParameter of classDecl.typeParameters?.params ?? []) {
    trackAdditionalTypeDependencyNode(ctx, typeParameter.constraint);
    trackAdditionalTypeDependencyNode(ctx, typeParameter.default);
  }
  const typeParameters = stripAngleBrackets(getTypeNodeText(ctx, classDecl.typeParameters));
  const heritage = readClassHeritage(ctx, classDecl);
  return { members, ...(typeParameters ? { typeParameters } : {}), ...heritage };
}

// Their names are tracked so imported ones get an `import type`.
function readClassHeritage(
  ctx: ParserContext,
  classDecl: ClassDeclarationLike,
): { extends?: string; implements?: string[] } {
  const heritage: { extends?: string; implements?: string[] } = {};
  const superClass = classDecl.superClass;
  if (superClass) {
    heritage.extends = getTypeNodeText(ctx, {
      start: superClass.start,
      end: classDecl.superTypeParameters?.end ?? superClass.end,
    });
    if (superClass.type === "Identifier") trackTypeReference(ctx, superClass, classDecl.superTypeParameters);
  }
  const implemented = (classDecl.implements ?? [])
    .map((clause) => {
      trackTypeReference(ctx, clause.expression, clause.typeParameters);
      return getTypeNodeText(ctx, clause);
    })
    .filter((text): text is string => Boolean(text));
  if (implemented.length > 0) heritage.implements = implemented;
  return heritage;
}

function trackTypeReference(
  ctx: ParserContext,
  typeName: EntityName,
  typeArguments: TSTypeParameterInstantiation | undefined,
) {
  trackAdditionalTypeDependencyNode(ctx, {
    type: "TSTypeReference",
    typeName,
    start: typeName.start,
    end: typeArguments?.end ?? typeName.end,
    ...(typeArguments ? { typeArguments } : {}),
  });
}

// In JS, `this.x = value` in the constructor declares `x`, typed by a
// `@type` above it, else `any`, unless a field already declares it.
function readConstructorAssignments(
  ctx: ParserContext,
  body: Statement[],
  declared: Set<string>,
): ComponentClassMember[] {
  const properties: ComponentClassMember[] = [];
  for (const statement of body) {
    const expression = statement.type === "ExpressionStatement" ? statement.expression : undefined;
    if (expression?.type !== "AssignmentExpression" || expression.operator !== "=") continue;
    const target = expression.left;
    if (target.type !== "MemberExpression" || target.computed || target.object.type !== "ThisExpression") continue;
    const name = target.property.type === "Identifier" ? target.property.name : undefined;
    if (!name || declared.has(name)) continue;
    declared.add(name);
    const jsdoc = processNodeJSDoc(ctx, statement);
    if (jsdoc?.internal) continue;
    properties.push({ kind: "property", name, type: jsdoc?.type ?? "any", ...memberDocs(jsdoc) });
  }
  return properties;
}
