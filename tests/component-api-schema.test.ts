import { readFileSync } from "node:fs";
import path from "node:path";

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
      ]),
    );
  });

  test("covers recent prop metadata fields", () => {
    const schema = readJson("schema/component-api.schema.json");
    const defs = objectProperty(schema, "$defs");
    const propProperties = objectProperty(objectProperty(defs, "prop"), "properties");

    expect(Object.keys(propProperties)).toEqual(
      expect.arrayContaining(["typeSource", "localName", "bindable", "defaultValue"]),
    );
    expect(objectProperty(propProperties, "typeSource")).toMatchObject({
      enum: ["typescript", "jsdoc", "default", "inferred", "unknown"],
    });
    expect(objectProperty(propProperties, "bindable")).toMatchObject({ const: true });
    expect(objectProperty(propProperties, "defaultValue")).toMatchObject({ $ref: "#/$defs/defaultValue" });
  });

  test("keeps representative combined output and focused fixture coverage", () => {
    const api = readJson("tests/e2e/svelte5-runes/COMPONENT_API.json");

    expect(api.schemaVersion).toBe(1);
    expect(objectProperty(api, "generator")).toMatchObject({ name: "sveld" });
    expect(api.total).toBe(1);

    const components = arrayProperty(api, "components");
    const runesButton = findObjectByProperty(components, "moduleName", "RunesButton");
    const runesProps = arrayProperty(runesButton, "props");
    const valueProp = findObjectByProperty(runesProps, "name", "value");

    expect(valueProp).toMatchObject({
      bindable: true,
      typeSource: "default",
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
});
