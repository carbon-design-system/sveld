import { resolvePropTypeAndDocs, resolveTypeSource } from "../src/parser/prop-shared";

describe("resolveTypeSource", () => {
  const cases: Array<[string, Parameters<typeof resolveTypeSource>[0], ReturnType<typeof resolveTypeSource>]> = [
    [
      "explicit TypeScript wins over everything",
      { hasTypeScriptType: true, hasJSDocType: true, inferredType: "string", finalType: "string" },
      "typescript",
    ],
    [
      "JSDoc wins over inferred/final",
      { hasTypeScriptType: false, hasJSDocType: true, inferredType: "string", finalType: "string" },
      "jsdoc",
    ],
    [
      "an inferred initializer type is 'default'",
      { hasTypeScriptType: false, hasJSDocType: false, inferredType: "string", finalType: "string" },
      "default",
    ],
    [
      "only a final type with no inferred type is 'inferred'",
      { hasTypeScriptType: false, hasJSDocType: false, finalType: "() => any" },
      "inferred",
    ],
    ["nothing resolved at all is 'unknown'", { hasTypeScriptType: false, hasJSDocType: false }, "unknown"],
  ];

  for (const [name, input, expected] of cases) {
    test(name, () => {
      expect(resolveTypeSource(input)).toBe(expected);
    });
  }
});

describe("resolvePropTypeAndDocs: type precedence", () => {
  const base = { initializerIsFunction: false, isFunctionDeclaration: false };

  test("explicit TypeScript type beats JSDoc, resolved, and inferred types", () => {
    const result = resolvePropTypeAndDocs({
      ...base,
      explicitType: "string",
      jsdocType: "number",
      resolvedType: "boolean",
      typeSeed: "object",
    });
    expect(result.type).toBe("string");
    expect(result.typeSource).toBe("typescript");
  });

  test("JSDoc type beats resolved and inferred types when there is no explicit type", () => {
    const result = resolvePropTypeAndDocs({
      ...base,
      jsdocType: "number",
      resolvedType: "boolean",
      typeSeed: "object",
    });
    expect(result.type).toBe("number");
    expect(result.typeSource).toBe("jsdoc");
  });

  test("a resolved (identifier default JSDoc) type beats a bare inferred type", () => {
    const result = resolvePropTypeAndDocs({
      ...base,
      resolvedType: "boolean",
      typeSeed: "object",
      inferredTypeForSource: "object",
    });
    expect(result.type).toBe("boolean");
    expect(result.typeSource).toBe("jsdoc");
  });

  test("falls back to the inferred initializer type when nothing else applies", () => {
    const result = resolvePropTypeAndDocs({
      ...base,
      typeSeed: "object",
      inferredTypeForSource: "object",
    });
    expect(result.type).toBe("object");
    expect(result.typeSource).toBe("default");
  });

  test("a bare `export function` with no JSDoc @type keeps its () => any placeholder", () => {
    const result = resolvePropTypeAndDocs({
      initializerIsFunction: true,
      isFunctionDeclaration: true,
      typeSeed: "() => any",
    });
    expect(result.type).toBe("() => any");
    expect(result.typeSource).toBe("inferred");
  });

  test("a bare `export function` builds its signature from @param/@returns when there is no @type", () => {
    const result = resolvePropTypeAndDocs({
      initializerIsFunction: true,
      isFunctionDeclaration: true,
      typeSeed: "() => any",
      jsdocParams: [{ name: "x", type: "number" }],
      jsdocReturnType: "string",
    });
    expect(result.type).toBe("(x: number) => string");
    expect(result.typeSource).toBe("jsdoc");
  });

  test("a bare `export function` with @returns but no @param becomes a zero-arg signature", () => {
    const result = resolvePropTypeAndDocs({
      initializerIsFunction: true,
      isFunctionDeclaration: true,
      typeSeed: "() => any",
      jsdocReturnType: "string",
    });
    expect(result.type).toBe("() => string");
  });

  test("an explicit @type on a function declaration overrides the () => any placeholder outright", () => {
    const result = resolvePropTypeAndDocs({
      initializerIsFunction: true,
      isFunctionDeclaration: true,
      typeSeed: "() => any",
      jsdocType: "(x: number) => void",
      jsdocReturnType: "string",
    });
    expect(result.type).toBe("(x: number) => void");
  });
});

describe("resolvePropTypeAndDocs: description/params/returnType merging", () => {
  const base = { initializerIsFunction: false, isFunctionDeclaration: false };

  test("JSDoc description wins over the resolved (identifier default) description", () => {
    const result = resolvePropTypeAndDocs({
      ...base,
      jsdocDescription: "from jsdoc",
      resolvedDescription: "from resolved",
    });
    expect(result.description).toBe("from jsdoc");
  });

  test("falls back to the resolved description when there is no JSDoc description", () => {
    const result = resolvePropTypeAndDocs({
      ...base,
      resolvedDescription: "from resolved",
    });
    expect(result.description).toBe("from resolved");
  });

  test("falls back to a matching @typedef's own description when typedefs are provided", () => {
    const result = resolvePropTypeAndDocs({
      ...base,
      explicitType: "MyCallback",
      typedefs: new Map([["MyCallback", { description: "typedef description" }]]),
    });
    expect(result.description).toBe("typedef description");
  });

  test("does not consult typedefs when none are provided (runes today)", () => {
    const result = resolvePropTypeAndDocs({
      ...base,
      explicitType: "MyCallback",
    });
    expect(result.description).toBeUndefined();
  });

  test("JSDoc params/returnType win over resolved params/returnType", () => {
    const result = resolvePropTypeAndDocs({
      ...base,
      jsdocParams: [{ name: "a", type: "string" }],
      jsdocReturnType: "void",
      resolvedParams: [{ name: "b", type: "number" }],
      resolvedReturnType: "boolean",
    });
    expect(result.params).toEqual([{ name: "a", type: "string" }]);
    expect(result.returnType).toBe("void");
  });
});

describe("resolvePropTypeAndDocs: isFunction", () => {
  test("an arrow/function-expression initializer is always a function", () => {
    const result = resolvePropTypeAndDocs({ initializerIsFunction: true, isFunctionDeclaration: false });
    expect(result.isFunction).toBe(true);
  });

  test("a bare `export function` declaration is always a function", () => {
    const result = resolvePropTypeAndDocs({ initializerIsFunction: false, isFunctionDeclaration: true });
    expect(result.isFunction).toBe(true);
  });

  test("legacy export let does not infer isFunction from a function-shaped type (preserved mode difference)", () => {
    const result = resolvePropTypeAndDocs({
      initializerIsFunction: false,
      isFunctionDeclaration: false,
      explicitType: "() => void",
    });
    expect(result.isFunction).toBe(false);
  });

  test("runes $props() infers isFunction from an explicit function-shaped type when opted in", () => {
    const result = resolvePropTypeAndDocs({
      initializerIsFunction: false,
      isFunctionDeclaration: false,
      explicitType: "() => void",
      inferIsFunctionFromTypeSignature: true,
    });
    expect(result.isFunction).toBe(true);
  });

  test("runes $props() infers isFunction from JSDoc @param even without a function-shaped type", () => {
    const result = resolvePropTypeAndDocs({
      initializerIsFunction: false,
      isFunctionDeclaration: false,
      jsdocParams: [{ name: "x", type: "number" }],
      inferIsFunctionFromTypeSignature: true,
    });
    expect(result.isFunction).toBe(true);
  });

  test("runes $props() infers isFunction from JSDoc @returns even without a function-shaped type", () => {
    const result = resolvePropTypeAndDocs({
      initializerIsFunction: false,
      isFunctionDeclaration: false,
      jsdocReturnType: "void",
      inferIsFunctionFromTypeSignature: true,
    });
    expect(result.isFunction).toBe(true);
  });

  test("a non-function type never infers isFunction, even when opted in", () => {
    const result = resolvePropTypeAndDocs({
      initializerIsFunction: false,
      isFunctionDeclaration: false,
      explicitType: "string",
      inferIsFunctionFromTypeSignature: true,
    });
    expect(result.isFunction).toBe(false);
  });
});
