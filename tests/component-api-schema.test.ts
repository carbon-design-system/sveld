import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { Glob } from "bun";
import {
  asNormalizedPath,
  buildComponentApiDocument,
  type ComponentDocs,
  ComponentParser,
  writeTsDefinition,
} from "../src/browser";
import { parseEntryExports } from "../src/parse-entry-exports";
import { renderJsonDocument } from "../src/writer/writer-json";

type JsonObject = Record<string, unknown>;

const root = process.cwd();

function readJson(relativePath: string): JsonObject {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf-8")) as JsonObject;
}

function objectProperty(object: JsonObject, property: string): JsonObject {
  const value = object[property];
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
  expect(Array.isArray(value)).toBe(false);
  expect(typeof value).toBe("object");
  return value as JsonObject;
}

function arrayProperty(object: JsonObject, property: string): unknown[] {
  const value = object[property];
  expect(Array.isArray(value)).toBe(true);
  return value as unknown[];
}

function stringArrayProperty(object: JsonObject, property: string): string[] {
  return arrayProperty(object, property) as string[];
}

function findObjectByProperty(items: unknown[], property: string, expected: unknown): JsonObject {
  const item = items.find((value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    return (value as JsonObject)[property] === expected;
  });

  expect(item).toBeDefined();
  return item as JsonObject;
}

describe("component API JSON schema", () => {
  test("documents the combined COMPONENT_API.json root shape", () => {
    const schema = readJson("schema/component-api.schema.json");
    const properties = objectProperty(schema, "properties");

    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(stringArrayProperty(schema, "required")).toEqual(["schemaVersion", "generator", "total", "components"]);
    expect(Object.keys(properties)).toEqual(
      expect.arrayContaining(["schemaVersion", "generator", "total", "components"]),
    );
    expect(objectProperty(properties, "components")).toMatchObject({
      type: "array",
      items: { $ref: "#/$defs/component" },
    });
  });

  test("defines reusable component metadata definitions", () => {
    const schema = readJson("schema/component-api.schema.json");
    const defs = objectProperty(schema, "$defs");

    expect(Object.keys(defs)).toEqual(
      expect.arrayContaining(["component", "prop", "slot", "event", "typedef", "context", "restProp", "sourceRange"]),
    );

    const componentProperties = objectProperty(objectProperty(defs, "component"), "properties");
    expect(Object.keys(componentProperties)).toEqual(
      expect.arrayContaining([
        "moduleName",
        "filePath",
        "source",
        "syntaxMode",
        "scriptLanguage",
        "props",
        "moduleExports",
        "slots",
        "events",
        "typedefs",
        "generics",
        "rest_props",
        "extends",
        "componentComment",
        "componentCommentSource",
        "contexts",
        "customElementTag",
        "customElement",
        "cssParts",
        "cssProperties",
      ]),
    );
  });

  test("documents the object-form customElement config and CSS parts/properties", () => {
    const schema = readJson("schema/component-api.schema.json");
    const defs = objectProperty(schema, "$defs");

    const customElementProperties = objectProperty(objectProperty(defs, "customElement"), "properties");
    expect(Object.keys(customElementProperties)).toEqual(expect.arrayContaining(["tag", "shadow", "props", "extend"]));

    const propConfigProperties = objectProperty(objectProperty(defs, "customElementPropConfig"), "properties");
    expect(Object.keys(propConfigProperties)).toEqual(expect.arrayContaining(["attribute", "reflect", "type"]));

    expect(stringArrayProperty(objectProperty(defs, "cssPart"), "required")).toEqual(["name"]);
    expect(stringArrayProperty(objectProperty(defs, "cssProperty"), "required")).toEqual(["name"]);

    const parser = new ComponentParser();
    const filePath = path.join(root, "tests", "fixtures", "cem-custom-element-object-config", "input.svelte");
    const source = readFileSync(filePath, "utf-8");
    const parsed = parser.parseSvelteComponent(source, { filePath, moduleName: "CemCustomElementObjectConfig" });
    const components: ComponentDocs = new Map([
      [
        "CemCustomElementObjectConfig",
        { ...parsed, moduleName: "CemCustomElementObjectConfig", filePath: asNormalizedPath(filePath) },
      ],
    ]);

    const ajv = new Ajv2020({ strict: true, allErrors: true });
    const validate = ajv.compile(schema);
    const document = buildComponentApiDocument(components);
    const valid = validate(document);
    if (!valid) throw new Error(`Schema validation failed:\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
    expect(valid).toBe(true);
  });

  test("documents the optional entry exports collection", () => {
    const schema = readJson("schema/component-api.schema.json");
    const properties = objectProperty(schema, "properties");
    const defs = objectProperty(schema, "$defs");

    // Optional: not part of the required root keys so default output is unchanged.
    expect(stringArrayProperty(schema, "required")).not.toContain("exports");
    expect(Object.keys(properties)).toEqual(expect.arrayContaining(["totalExports", "exports"]));
    expect(objectProperty(properties, "exports")).toMatchObject({
      type: "array",
      items: { $ref: "#/$defs/entryExport" },
    });

    const entryExportProperties = objectProperty(objectProperty(defs, "entryExport"), "properties");
    expect(Object.keys(entryExportProperties)).toEqual(
      expect.arrayContaining([
        "name",
        "kind",
        "type",
        "value",
        "description",
        "deprecated",
        "tags",
        "source",
        "isTypeOnly",
      ]),
    );
    expect(objectProperty(entryExportProperties, "deprecated")).toMatchObject({ $ref: "#/$defs/deprecated" });
    expect(objectProperty(entryExportProperties, "tags")).toMatchObject({ items: { $ref: "#/$defs/jsdocTag" } });
    expect(objectProperty(entryExportProperties, "kind")).toMatchObject({
      enum: ["const", "let", "var", "function", "class", "type", "interface", "enum"],
    });
    expect(stringArrayProperty(objectProperty(defs, "entryExport"), "required")).toEqual([
      "name",
      "kind",
      "isTypeOnly",
    ]);
  });

  test("typedefs and contexts carry a source range like other component metadata", () => {
    const schema = readJson("schema/component-api.schema.json");
    const defs = objectProperty(schema, "$defs");

    for (const def of ["typedef", "context"]) {
      const properties = objectProperty(objectProperty(defs, def), "properties");
      expect(objectProperty(properties, "source")).toMatchObject({ $ref: "#/$defs/sourceRange" });
    }
  });

  test("covers recent prop metadata fields", () => {
    const schema = readJson("schema/component-api.schema.json");
    const defs = objectProperty(schema, "$defs");
    const propProperties = objectProperty(objectProperty(defs, "prop"), "properties");

    expect(Object.keys(propProperties)).toEqual(
      expect.arrayContaining(["typeSource", "localName", "bindable", "defaultValue", "tags", "source"]),
    );
    expect(objectProperty(propProperties, "typeSource")).toMatchObject({
      enum: ["typescript", "jsdoc", "default", "inferred", "unknown"],
    });
    expect(objectProperty(propProperties, "bindable")).toMatchObject({ const: true });
    expect(objectProperty(propProperties, "defaultValue")).toMatchObject({ $ref: "#/$defs/defaultValue" });
    expect(objectProperty(propProperties, "tags")).toMatchObject({ items: { $ref: "#/$defs/jsdocTag" } });
  });

  test("surfaces IDE-facing tags on props and both event variants", () => {
    const schema = readJson("schema/component-api.schema.json");
    const defs = objectProperty(schema, "$defs");

    for (const def of ["prop", "dispatchedEvent", "forwardedEvent"]) {
      const properties = objectProperty(objectProperty(defs, def), "properties");
      expect(objectProperty(properties, "tags")).toMatchObject({
        type: "array",
        items: { $ref: "#/$defs/jsdocTag" },
      });
    }

    expect(objectProperty(defs, "jsdocTag")).toMatchObject({
      required: ["name", "body"],
    });
  });

  test("documents @deprecated across props, slots, and events", () => {
    const schema = readJson("schema/component-api.schema.json");
    const defs = objectProperty(schema, "$defs");

    expect(objectProperty(defs, "deprecated")).toMatchObject({
      oneOf: [{ type: "string" }, { const: true }],
    });

    for (const def of ["prop", "slot", "dispatchedEvent", "forwardedEvent"]) {
      const properties = objectProperty(objectProperty(defs, def), "properties");
      expect(objectProperty(properties, "deprecated")).toMatchObject({ $ref: "#/$defs/deprecated" });
    }
  });

  test("represents @deprecated in focused fixture output", () => {
    const focused = readJson("tests/fixtures/deprecated-tags/output.json");

    const props = arrayProperty(focused, "props");
    expect(findObjectByProperty(props, "name", "label")).toMatchObject({
      deprecated: "Use the `text` prop instead.",
    });
    // A bare `@deprecated` is represented as `true`.
    expect(findObjectByProperty(props, "name", "id")).toMatchObject({ deprecated: true });
    expect(findObjectByProperty(props, "name", "focus")).toMatchObject({
      deprecated: "Focus the underlying element directly.",
    });

    const slots = arrayProperty(focused, "slots");
    expect(findObjectByProperty(slots, "name", "badge")).toMatchObject({
      deprecated: "Render the badge inline instead.",
    });

    const events = arrayProperty(focused, "events");
    expect(findObjectByProperty(events, "name", "change")).toMatchObject({
      deprecated: "Listen for the native `input` event instead.",
    });
  });

  test("keeps representative combined output and focused fixture coverage", () => {
    const api = readJson("tests/e2e/svelte5-vite/COMPONENT_API.json");

    expect(api.schemaVersion).toBe(1);
    expect(objectProperty(api, "generator")).toMatchObject({ name: "sveld" });
    expect(api.total).toBe(3);

    const components = arrayProperty(api, "components");
    const runesButton = findObjectByProperty(components, "moduleName", "RunesButton");
    const runesProps = arrayProperty(runesButton, "props");
    const valueProp = findObjectByProperty(runesProps, "name", "value");

    expect(valueProp).toMatchObject({
      bindable: true,
      typeSource: "typescript",
      defaultValue: {
        raw: '"ready"',
        kind: "literal",
        value: "ready",
      },
    });

    const focused = readJson("tests/fixtures/runes-prop-metadata-consolidated/output.json");
    const focusedProps = arrayProperty(focused, "props");
    const aliasedClassProp = findObjectByProperty(focusedProps, "name", "class");
    const bindableValueProp = findObjectByProperty(focusedProps, "name", "value");

    expect(aliasedClassProp).toMatchObject({
      localName: "className",
      typeSource: "default",
      defaultValue: {
        raw: '"primary"',
        kind: "literal",
        value: "primary",
      },
    });
    expect(bindableValueProp).toMatchObject({
      bindable: true,
      defaultValue: {
        raw: "0",
        kind: "literal",
        value: 0,
      },
    });
  });

  test("@ignore/@internal excludes members from the built document and .d.ts, but not from the raw parse", () => {
    const filePath = path.join(root, "tests", "fixtures", "jsdoc-internal-ignore", "input.svelte");
    const source = readFileSync(filePath, "utf-8");
    const parser = new ComponentParser();
    const parsed = parser.parseSvelteComponent(source, { filePath, moduleName: "JsdocInternalIgnore" });
    const component = { ...parsed, moduleName: "JsdocInternalIgnore", filePath: asNormalizedPath(filePath) };

    // The raw ParsedComponent keeps every member, flagged `internal: true`.
    expect(findObjectByProperty(component.props, "name", "debugId")).toMatchObject({ internal: true });
    expect(findObjectByProperty(component.props, "name", "legacyFlag")).toMatchObject({ internal: true });
    expect(findObjectByProperty(component.moduleExports, "name", "INTERNAL_CONST")).toMatchObject({
      internal: true,
    });
    expect(findObjectByProperty(component.events, "name", "debug")).toMatchObject({ internal: true });
    expect(findObjectByProperty(component.slots, "name", "debug-panel")).toMatchObject({ internal: true });
    expect(findObjectByProperty(component.typedefs, "name", "InternalCount")).toMatchObject({ internal: true });

    const components: ComponentDocs = new Map([["JsdocInternalIgnore", component]]);
    const document = buildComponentApiDocument(components);
    const filtered = document.components[0];

    expect(filtered.props.map((p) => p.name)).not.toEqual(expect.arrayContaining(["debugId", "legacyFlag"]));
    expect(filtered.moduleExports.map((e) => e.name)).not.toContain("INTERNAL_CONST");
    expect(filtered.events.map((e) => e.name)).not.toContain("debug");
    expect(filtered.slots.map((s) => s.name)).not.toContain("debug-panel");
    expect(filtered.typedefs.map((t) => t.name)).not.toContain("InternalCount");

    // Public members survive filtering untouched.
    expect(filtered.props.map((p) => p.name)).toContain("label");
    expect(filtered.moduleExports.map((e) => e.name)).toContain("PUBLIC_CONST");
    expect(filtered.events.map((e) => e.name)).toContain("change");
    expect(filtered.slots.map((s) => s.name)).toContain("badge");
    expect(filtered.typedefs.map((t) => t.name)).toContain("PublicLabel");

    const dts = writeTsDefinition(filtered, { format: "class" });
    expect(dts).not.toContain("debugId");
    expect(dts).not.toContain("legacyFlag");
    expect(dts).not.toContain("INTERNAL_CONST");
    expect(dts).not.toContain("debug-panel");
    expect(dts).not.toContain("InternalCount");
    expect(dts).not.toContain('"debug"');
    expect(dts).toContain("label");
    expect(dts).toContain("PublicLabel");
  });

  test("@internal on an identifier-valued context property excludes only that property", () => {
    const source = `
<script>
  import { setContext } from "svelte";

  /**
   * Public user info.
   * @type {{ name: string }}
   */
  let publicUser = { name: "" };

  /**
   * Internal-only debug token.
   * @type {string}
   * @internal
   */
  let debugToken = "";

  setContext("session", { user: publicUser, debug: debugToken });
</script>
`;
    const filePath = path.join(root, "tests", "fixtures", "jsdoc-internal-ignore", "context-property.svelte");
    const parser = new ComponentParser();
    const parsed = parser.parseSvelteComponent(source, { filePath, moduleName: "ContextPropertyInternal" });
    const component = { ...parsed, moduleName: "ContextPropertyInternal", filePath: asNormalizedPath(filePath) };

    // The raw ParsedComponent keeps both properties, with only `debug` flagged `internal: true`.
    const sessionContext = findObjectByProperty(component.contexts ?? [], "key", "session");
    const rawProperties = arrayProperty(sessionContext, "properties");
    expect(findObjectByProperty(rawProperties, "name", "user")).not.toMatchObject({ internal: true });
    expect(findObjectByProperty(rawProperties, "name", "debug")).toMatchObject({ internal: true });

    const components: ComponentDocs = new Map([["ContextPropertyInternal", component]]);
    const document = buildComponentApiDocument(components);
    const filtered = document.components[0];

    const filteredContext = findObjectByProperty(filtered.contexts ?? [], "key", "session");
    const filteredProperties = arrayProperty(filteredContext, "properties");
    expect(filteredProperties.map((p) => (p as JsonObject).name)).toContain("user");
    expect(filteredProperties.map((p) => (p as JsonObject).name)).not.toContain("debug");
  });
});

// Representative directory-name prefixes chosen to cover every syntax mode
// (runes/legacy), the typedef/context/slot metadata shapes, and entry-barrel
// exports, without validating all ~90 fixtures on every run.
const FIXTURE_PREFIXES = ["runes-", "legacy-", "typedef-", "context-", "slot-"];

async function buildRepresentativeFixtureComponents(): Promise<ComponentDocs> {
  const fixturesRoot = path.join(root, "tests", "fixtures");
  const parser = new ComponentParser();
  const components: ComponentDocs = new Map();

  for await (const file of new Glob("**/input.svelte").scan(fixturesRoot)) {
    const normalizedFile = file.replace(/\\/g, "/");
    const dir = normalizedFile.slice(0, normalizedFile.length - "/input.svelte".length);
    if (!FIXTURE_PREFIXES.some((prefix) => dir.startsWith(prefix))) continue;

    const filePath = path.join(fixturesRoot, normalizedFile);
    const source = readFileSync(filePath, "utf-8");
    const parsed = parser.parseSvelteComponent(source, { filePath, moduleName: dir });
    components.set(dir, { ...parsed, moduleName: dir, filePath: asNormalizedPath(filePath) });
  }

  return components;
}

describe("component API JSON schema validates real emitted output", () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const schema = readJson("schema/component-api.schema.json");
  const validate = ajv.compile(schema);

  function expectValid(document: unknown) {
    const valid = validate(document);
    if (!valid) {
      throw new Error(`Schema validation failed:\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
    }
    expect(valid).toBe(true);
  }

  test("validates the combined document for representative fixtures", async () => {
    const components = await buildRepresentativeFixtureComponents();
    expect(components.size).toBeGreaterThan(0);

    const document = buildComponentApiDocument(components);
    expectValid(document);
  });

  test("validates the document when entry-barrel exports are included", async () => {
    const components = await buildRepresentativeFixtureComponents();
    const entryExports = await parseEntryExports(path.join(root, "tests", "fixtures-entry-exports", "index.ts"));

    const document = buildComponentApiDocument(components, { entryExports });
    expect(document.exports).toBeDefined();
    expectValid(document);
  });

  test("validates the committed svelte5-vite e2e COMPONENT_API.json", () => {
    const api = readJson("tests/e2e/svelte5-vite/COMPONENT_API.json");
    expectValid(api);
  });

  test("validates the document with jsonOptions.source: false, and strips every source range", async () => {
    const components = await buildRepresentativeFixtureComponents();

    const rendered = renderJsonDocument(components, { inputDir: root, source: false });
    const document = JSON.parse(rendered) as JsonObject;
    expectValid(document);

    for (const component of arrayProperty(document, "components")) {
      expect(JSON.stringify(component)).not.toContain('"source"');
      expect(JSON.stringify(component)).not.toContain('"componentCommentSource"');
    }
  });

  const carbonApiPath = "tests/e2e/carbon/COMPONENT_API.json";
  const hasCarbonApi = existsSync(path.join(root, carbonApiPath));

  test.skipIf(!hasCarbonApi)("validates the committed carbon e2e COMPONENT_API.json", () => {
    if (!hasCarbonApi) {
      console.warn(`Skipping: ${carbonApiPath} not found in the working tree.`);
      return;
    }
    expectValid(readJson(carbonApiPath));
  });
});
