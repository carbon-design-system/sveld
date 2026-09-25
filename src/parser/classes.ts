import type ComponentParser from "../ComponentParser";
import type { ComponentClassMember, ComponentPropParam, ModernRunesTypeNode } from "../ComponentParser";
import type { ParserContext } from "./context";
import { processNodeJSDoc } from "./jsdoc";
import {
  type FunctionDeclarationLike,
  getTypeAnnotationText,
  getTypeNodeText,
  readFunctionDeclarationParts,
  trackAdditionalTypeDependencyNode,
} from "./type-resolution";

type TypeAnnotationNode = { start?: number; end?: number; typeAnnotation?: ModernRunesTypeNode };

type MethodValueNode = FunctionDeclarationLike & {
  type?: string;
  async?: boolean;
  body?: { body?: StatementNode[] } | null;
};

type ParamNode = NonNullable<FunctionDeclarationLike["params"]>[number] & {
  accessibility?: "public" | "private" | "protected";
  readonly?: boolean;
  leadingComments?: unknown[];
};

type ClassMemberNode = {
  type: string;
  kind?: "constructor" | "method" | "get" | "set";
  key?: { type: string; name?: string; value?: unknown };
  computed?: boolean;
  static?: boolean;
  readonly?: boolean;
  optional?: boolean;
  abstract?: boolean;
  accessibility?: "public" | "private" | "protected";
  typeAnnotation?: TypeAnnotationNode;
  /** A method's own `<U>`: on the method, not its function value. */
  typeParameters?: FunctionDeclarationLike["typeParameters"];
  value?: unknown;
  leadingComments?: unknown[];
  start?: number;
};

type StatementNode = {
  type: string;
  expression?: {
    type: string;
    operator?: string;
    left?: { type: string; computed?: boolean; object?: { type: string }; property?: { type: string; name?: string } };
  };
  leadingComments?: unknown[];
  start?: number;
};

/** The subset of a `ClassDeclaration` AST shape {@link readClassDeclaration} reads. */
export type ClassDeclarationLike = {
  typeParameters?: {
    start?: number;
    end?: number;
    params?: Array<{ constraint?: ModernRunesTypeNode; default?: ModernRunesTypeNode }>;
  };
  /** `extends Base`: the base class expression, and its type arguments (`Base<T>`). */
  superClass?: { type?: string; start?: number; end?: number } | null;
  superTypeParameters?: { start?: number; end?: number; params?: ModernRunesTypeNode[] };
  /** `implements A<T>, B`. */
  implements?: Array<{
    start?: number;
    end?: number;
    expression?: unknown;
    typeParameters?: { params?: ModernRunesTypeNode[] };
  }>;
  body?: { body?: unknown[] };
};

type MemberJSDoc = ReturnType<typeof processNodeJSDoc>;

const MEMBER_NODE_TYPES = new Set(["MethodDefinition", "PropertyDefinition", "AccessorProperty"]);

/** `name`, `"quoted-name"`, or `0`; unset for a computed (`[Symbol.iterator]`) or `#private` key. */
function memberName(member: ClassMemberNode): string | undefined {
  if (member.computed || !member.key) return undefined;
  if (member.key.type === "Identifier") return member.key.name;
  if (member.key.type === "Literal" && (typeof member.key.value === "string" || typeof member.key.value === "number")) {
    return String(member.key.value);
  }
  return undefined;
}

function isHidden(accessibility: string | undefined): boolean {
  return accessibility === "private" || accessibility === "protected";
}

/** A member's description, `@deprecated`, and passthrough tags, leaving out unset ones. */
function memberDocs(jsdoc: MemberJSDoc): Pick<ComponentClassMember, "description" | "deprecated" | "tags"> {
  return {
    ...(jsdoc?.description ? { description: jsdoc.description } : {}),
    ...(jsdoc?.deprecated === undefined ? {} : { deprecated: jsdoc.deprecated }),
    ...(jsdoc?.tags ? { tags: jsdoc.tags } : {}),
  };
}

/** `<T extends U = V>` -> `T extends U = V`. */
function stripAngleBrackets(typeParameters: string | undefined): string | undefined {
  return typeParameters?.slice(1, -1).trim() || undefined;
}

/**
 * A method or constructor's params, return type, and own type parameters:
 * each from its TypeScript annotation, else its JSDoc tag, else `any`.
 */
function readMethodSignature(
  ctx: ParserContext,
  fn: MethodValueNode,
  jsdoc: MemberJSDoc,
): Pick<ComponentClassMember, "params" | "returnType" | "typeParameters"> {
  const parts = readFunctionDeclarationParts(ctx, fn);
  const jsdocParams = new Map((jsdoc?.params ?? []).map((param) => [param.name, param]));
  const params = parts.params.map(({ name, type, optional, rest }): ComponentPropParam => {
    const doc = jsdocParams.get(name);
    return {
      name: rest ? `...${name}` : name,
      type: type ?? doc?.type ?? (rest ? "any[]" : "any"),
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

/**
 * The public members of a module-script class: its constructor, methods,
 * properties (fields, constructor parameter properties, getter/setter pairs,
 * and, in a JS script, `this.x = ...` assignments in the constructor), in
 * source order. Private (`#x`, `private`), `protected`, computed-key, and
 * `@internal`/`@ignore` members are left out. An overloaded method keeps
 * its overload signatures, not its implementation's.
 *
 * Returns the class's own TS type parameters too (without angle brackets).
 */
export function readClassDeclaration(
  ctx: ParserContext,
  parser: ComponentParser,
  classDecl: ClassDeclarationLike,
): { members: ComponentClassMember[]; typeParameters?: string; extends?: string; implements?: string[] } {
  const members: ComponentClassMember[] = [];
  /** Getter/setter pairs, keyed `static name` or `name`, merged into one property. */
  const accessors = new Map<string, ComponentClassMember>();
  /** Methods with (non-abstract) overload signatures, whose implementation is left out. */
  const overloaded = new Set<string>();
  const instanceProperties = new Set<string>();
  let constructorBody: StatementNode[] | undefined;
  let constructorIndex = -1;

  for (const rawMember of classDecl.body?.body ?? []) {
    const member = rawMember as ClassMemberNode;
    if (!MEMBER_NODE_TYPES.has(member.type) || isHidden(member.accessibility)) continue;
    const name = memberName(member);
    if (name === undefined) continue;
    const jsdoc = processNodeJSDoc(ctx, parser, member);
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
        type: getTypeAnnotationText(ctx, member.typeAnnotation) ?? jsdoc?.type ?? "any",
        ...modifiers,
        ...(member.readonly ? { readonly: true as const } : {}),
        ...memberDocs(jsdoc),
      });
      continue;
    }

    const value = member.value as MethodValueNode;
    const fn = member.typeParameters ? { ...value, typeParameters: member.typeParameters } : value;

    if (member.kind === "constructor") {
      const signature = readMethodSignature(ctx, fn, jsdoc);
      members.push({ kind: "constructor", name: "constructor", params: signature.params, ...memberDocs(jsdoc) });
      constructorIndex = members.length;
      constructorBody = fn.body?.body;
      // `constructor(public x: T)` also declares a property `x`.
      const params = (fn.params ?? []) as ParamNode[];
      params.forEach((param, index) => {
        if (param.type !== "TSParameterProperty" || isHidden(param.accessibility)) return;
        const signatureParam = signature.params?.[index];
        if (!signatureParam) return;
        instanceProperties.add(signatureParam.name);
        members.push({
          kind: "property",
          name: signatureParam.name,
          type: signatureParam.type,
          ...(param.readonly ? { readonly: true as const } : {}),
          ...(signatureParam.description ? { description: signatureParam.description } : {}),
        });
      });
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

    // `f(a: string): void;` with no body: an overload signature (or an abstract method).
    if (fn.type === "TSDeclareMethod" && !member.abstract) overloaded.add(key);
    else if (fn.type !== "TSDeclareMethod" && overloaded.has(key)) continue;
    members.push({ kind: "method", name, ...modifiers, ...readMethodSignature(ctx, fn, jsdoc), ...memberDocs(jsdoc) });
  }

  if (ctx.scriptLanguage !== "ts" && constructorBody) {
    members.splice(
      constructorIndex,
      0,
      ...readConstructorAssignments(ctx, parser, constructorBody, instanceProperties),
    );
  }

  for (const typeParameter of classDecl.typeParameters?.params ?? []) {
    trackAdditionalTypeDependencyNode(ctx, typeParameter.constraint);
    trackAdditionalTypeDependencyNode(ctx, typeParameter.default);
  }
  const typeParameters = stripAngleBrackets(getTypeNodeText(ctx, classDecl.typeParameters));
  const heritage = readClassHeritage(ctx, classDecl);
  return { members, ...(typeParameters ? { typeParameters } : {}), ...heritage };
}

/**
 * The class's `extends` and `implements` clauses as source text, with the
 * names they reference tracked as type dependencies, so an imported base
 * class or interface gets an `import type` in the `.d.ts`.
 */
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
    if (superClass.type === "Identifier") {
      trackAdditionalTypeDependencyNode(ctx, {
        type: "TSTypeReference",
        typeName: superClass,
        ...(classDecl.superTypeParameters ? { typeParameters: classDecl.superTypeParameters } : {}),
      } as ModernRunesTypeNode);
    }
  }
  const implemented = (classDecl.implements ?? [])
    .map((clause) => {
      trackAdditionalTypeDependencyNode(ctx, {
        type: "TSTypeReference",
        typeName: clause.expression,
        ...(clause.typeParameters ? { typeParameters: clause.typeParameters } : {}),
      } as ModernRunesTypeNode);
      return getTypeNodeText(ctx, clause);
    })
    .filter((text): text is string => Boolean(text));
  if (implemented.length > 0) heritage.implements = implemented;
  return heritage;
}

/**
 * `this.x = value` statements in a JS class's constructor, which declare
 * property `x` (typed by a `@type` tag above the statement, else `any`),
 * unless a field already declares it.
 */
function readConstructorAssignments(
  ctx: ParserContext,
  parser: ComponentParser,
  body: StatementNode[],
  declared: Set<string>,
): ComponentClassMember[] {
  const properties: ComponentClassMember[] = [];
  for (const statement of body) {
    const expression = statement.type === "ExpressionStatement" ? statement.expression : undefined;
    if (expression?.type !== "AssignmentExpression" || expression.operator !== "=") continue;
    const target = expression.left;
    if (target?.type !== "MemberExpression" || target.computed || target.object?.type !== "ThisExpression") continue;
    const name = target.property?.type === "Identifier" ? target.property.name : undefined;
    if (!name || declared.has(name)) continue;
    declared.add(name);
    const jsdoc = processNodeJSDoc(ctx, parser, statement);
    if (jsdoc?.internal) continue;
    properties.push({ kind: "property", name, type: jsdoc?.type ?? "any", ...memberDocs(jsdoc) });
  }
  return properties;
}
