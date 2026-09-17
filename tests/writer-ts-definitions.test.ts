import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import ts from "@typescript/typescript6";
import { asNormalizedPath } from "../src/brands";
import { generateBundle } from "../src/bundle";
import type { ParsedComponent } from "../src/ComponentParser";
import ComponentParser, { PARSED_COMPONENT_TYPE_SCRIPT_METADATA } from "../src/ComponentParser";
import { setQuiet } from "../src/logger";
import { ParseCache } from "../src/parse-cache";
import type { ComponentDocApi, ComponentDocs } from "../src/plugin";
import type { TransformContext, WriteTsDefinitionsOptions } from "../src/writer/writer-ts-definitions";
import writeTsDefinitions, {
  formatTsProps,
  getContextDefs,
  getTypeDefs,
  writeTsDefinition,
} from "../src/writer/writer-ts-definitions";
import {
  exportsTypeName,
  pickEmitOptions,
  propsTypeName,
  serializeEmitOptions,
} from "../src/writer/writer-ts-definitions-core";
import { mockComponentDocApi, mockParsedExports } from "./test-brands";

const DEFAULT_SLOT_SNIPPET_PROP_REGEX = /default\?\s*:\s*\(\)\s*=>\s*void/;

describe("writerTsDefinition", () => {
  test("writeTsDefinition", () => {
    expect(formatTsProps(undefined)).toEqual("any");
    expect(formatTsProps("{ a: null }")).toEqual("{ a: null }\n");
    expect(getTypeDefs({ typedefs: [] })).toEqual("");
    expect(
      getTypeDefs({
        typedefs: [
          {
            type: "{ [key: string]: boolean; }",
            name: "MyTypedef",
            ts: "interface MyTypedef { [key: string]: boolean; }",
          },
        ],
      }),
    ).toEqual("export interface MyTypedef { [key: string]: boolean; }");

    const parsed_output: ParsedComponent = {
      syntaxMode: "legacy",
      props: [
        {
          name: "propBool",
          kind: "let",
          type: "boolean",
          value: "true",
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: true,
        },
        {
          name: "propString",
          kind: "let",
          type: "string",
          value: '""',
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: false,
        },
        {
          name: "name",
          kind: "let",
          type: "string",
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: false,
        },
        {
          name: "id",
          kind: "let",
          type: "string",
          value: '"" + Math.random().toString(36)',
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: false,
        },
        {
          name: "propConst",
          kind: "const",
          type: "{ [key: string]: boolean; }",
          value: '{ ["1"]: true }',
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: true,
          reactive: false,
        },
        {
          name: "fn",
          kind: "function",
          type: "() => {     localBool = !localBool;   }",
          isFunction: true,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: false,
        },
      ],
      moduleExports: [],
      slots: [
        {
          name: "__default__",
          default: true,
          fallback: "{name}",
          slot_props: "{}",
        },
      ],
      events: [],
      typedefs: [],
      generics: null,
      rest_props: undefined,
    };

    const component_api: ComponentDocApi = {
      moduleName: "ModuleName",
      filePath: asNormalizedPath("./src/ModuleName.svelte"),
      ...parsed_output,
    };

    expect(writeTsDefinition(component_api)).toMatchSnapshot();
  });

  test('"default" module name', () => {
    const component_api: ComponentDocApi = {
      moduleName: "default",
      filePath: asNormalizedPath("./src/ModuleName.svelte"),
      syntaxMode: "legacy",
      props: [],
      moduleExports: [],
      slots: [],
      events: [],
      typedefs: [],
      generics: null,
      rest_props: undefined,
    };

    expect(writeTsDefinition(component_api)).toMatchSnapshot();
  });

  test("getContextDefs with empty context", () => {
    // Empty context object should use Record<string, never> instead of {}
    expect(
      getContextDefs({
        contexts: [
          {
            key: "BreadcrumbItem",
            typeName: "BreadcrumbItemContext",
            properties: [],
          },
        ],
        generics: null,
      }),
    ).toEqual("export type BreadcrumbItemContext = Record<string, never>;");
  });

  test("getContextDefs with properties", () => {
    // Context with properties should still use object literal syntax
    expect(
      getContextDefs({
        contexts: [
          {
            key: "simple-modal",
            typeName: "SimpleModalContext",
            properties: [
              {
                name: "open",
                type: "(component: any, props?: any) => void",
                description: "Open the modal",
                optional: false,
              },
              {
                name: "close",
                type: "() => void",
                optional: false,
              },
            ],
          },
        ],
        generics: null,
      }),
    ).toEqual(
      "export type SimpleModalContext = {\n  /** Open the modal */\n  open: (component: any, props?: any) => void;\n  close: () => void;\n};",
    );
  });

  test("getContextDefs with generics", () => {
    // Context that references generic types should include the generic parameter
    expect(
      getContextDefs({
        contexts: [
          {
            key: "DataTable",
            typeName: "DataTableContext",
            properties: [
              {
                name: "batchSelectedIds",
                type: 'import("svelte/store").Writable<ReadonlyArray<DataTableRowId>>',
                optional: false,
              },
              {
                name: "tableRows",
                type: 'import("svelte/store").Writable<ReadonlyArray<Row>>',
                optional: false,
              },
              {
                name: "resetSelectedRowIds",
                type: "() => void",
                optional: false,
              },
              {
                name: "filterRows",
                type: "(searchValue: string, customFilter?: (row: Row, value: string) => boolean) => ReadonlyArray<DataTableRowId>",
                optional: false,
              },
            ],
          },
        ],
        generics: ["Row", "Row extends DataTableRow = DataTableRow"],
      }),
    ).toEqual(
      'export type DataTableContext<Row extends DataTableRow = DataTableRow> = {\n  batchSelectedIds: import("svelte/store").Writable<ReadonlyArray<DataTableRowId>>;\n  tableRows: import("svelte/store").Writable<ReadonlyArray<Row>>;\n  resetSelectedRowIds: () => void;\n  filterRows: (searchValue: string, customFilter?: (row: Row, value: string) => boolean) => ReadonlyArray<DataTableRowId>;\n};',
    );
  });

  test("getContextDefs with multiple generics referenced", () => {
    // Context referencing two `@template` generics should emit the full parameter list
    expect(
      getContextDefs({
        contexts: [
          {
            key: "demo:Wrapper",
            typeName: "DemoWrapperContext",
            properties: [
              {
                name: "selectedValue",
                type: 'import("svelte/store").Writable<Value | undefined>',
                optional: false,
              },
              {
                name: "icon",
                type: "Icon",
                optional: false,
              },
            ],
          },
        ],
        generics: ["Value,Icon", "Value extends string = string, Icon = any"],
      }),
    ).toEqual(
      'export type DemoWrapperContext<Value extends string = string, Icon = any> = {\n  selectedValue: import("svelte/store").Writable<Value | undefined>;\n  icon: Icon;\n};',
    );
  });

  test("getContextDefs with multiple generics, only one referenced", () => {
    // Only the generics actually referenced by the context should be emitted
    expect(
      getContextDefs({
        contexts: [
          {
            key: "demo:Wrapper",
            typeName: "DemoWrapperContext",
            properties: [
              {
                name: "selectedValue",
                type: 'import("svelte/store").Writable<Value | undefined>',
                optional: false,
              },
            ],
          },
        ],
        generics: ["Value,Icon", "Value extends string = string, Icon = any"],
      }),
    ).toEqual(
      'export type DemoWrapperContext<Value extends string = string> = {\n  selectedValue: import("svelte/store").Writable<Value | undefined>;\n};',
    );
  });

  test("getContextDefs splits constraints with nested commas", () => {
    // Constraints that contain commas (e.g. inside `<>`) must not be split apart
    expect(
      getContextDefs({
        contexts: [
          {
            key: "demo:Wrapper",
            typeName: "DemoWrapperContext",
            properties: [
              { name: "row", type: "Row", optional: false },
              { name: "icon", type: "Icon", optional: false },
            ],
          },
        ],
        generics: ["Row,Icon", "Row extends Record<string, any> = Record<string, any>, Icon = any"],
      }),
    ).toEqual(
      "export type DemoWrapperContext<Row extends Record<string, any> = Record<string, any>, Icon = any> = {\n  row: Row;\n  icon: Icon;\n};",
    );
  });

  test("getContextDefs without generics reference", () => {
    // Context that doesn't reference generic types should NOT include the generic parameter
    expect(
      getContextDefs({
        contexts: [
          {
            key: "simple-context",
            typeName: "SimpleContext",
            properties: [
              {
                name: "count",
                type: "number",
                optional: false,
              },
            ],
          },
        ],
        generics: ["Row", "Row extends DataTableRow = DataTableRow"],
      }),
    ).toEqual("export type SimpleContext = {\n  count: number;\n};");
  });

  test("getContextDefs with regex-metacharacter generic name", () => {
    // A malformed `@template` name containing an unescaped regex metacharacter
    // (here an unbalanced "(") previously threw `SyntaxError: Invalid regular
    // expression` when building the word-boundary check. It must not throw, and
    // must still correctly detect the reference.
    expect(
      getContextDefs({
        contexts: [
          {
            key: "demo:Wrapper",
            typeName: "DemoWrapperContext",
            properties: [{ name: "value", type: "T(x)", optional: false }],
          },
        ],
        generics: ["T(", "T( extends string = string"],
      }),
    ).toEqual("export type DemoWrapperContext<T( extends string = string> = {\n  value: T(x);\n};");
  });

  test("generates function signatures from @param and @returns", () => {
    const component_api: ComponentDocApi = {
      moduleName: "TestComponent",
      filePath: asNormalizedPath("./src/TestComponent.svelte"),
      syntaxMode: "legacy",
      props: [
        {
          name: "add",
          kind: "function",
          type: "() => any", // Default type
          isFunction: true,
          isFunctionDeclaration: true,
          isRequired: false,
          constant: false,
          reactive: false,
          params: [
            {
              name: "notification",
              type: "NotificationData",
              optional: false,
            },
          ],
          returnType: "string",
        },
        {
          name: "remove",
          kind: "function",
          type: "() => any", // Default type
          isFunction: true,
          isFunctionDeclaration: true,
          isRequired: false,
          constant: false,
          reactive: false,
          params: [
            {
              name: "id",
              type: "string",
              optional: false,
            },
          ],
          returnType: "boolean",
        },
        {
          name: "getCount",
          kind: "function",
          type: "() => any", // Default type
          isFunction: true,
          isFunctionDeclaration: true,
          isRequired: false,
          constant: false,
          reactive: false,
          returnType: "number", // Only @returns, no @param
        },
        {
          name: "log",
          kind: "function",
          type: "() => any", // Default type
          isFunction: true,
          isFunctionDeclaration: true,
          isRequired: false,
          constant: false,
          reactive: false,
          params: [
            {
              name: "message",
              type: "string",
              optional: false,
            },
          ],
          // No @returns, should default to any
        },
        {
          name: "update",
          kind: "function",
          type: "() => any", // Default type
          isFunction: true,
          isFunctionDeclaration: true,
          isRequired: false,
          constant: false,
          reactive: false,
          params: [
            {
              name: "id",
              type: "string",
              optional: false,
            },
            {
              name: "data",
              type: "NotificationData",
              optional: true, // Optional parameter
            },
          ],
          returnType: "boolean",
        },
        {
          name: "multiply",
          kind: "function",
          type: "(a: number, b: number) => number", // Custom @type, should take priority
          isFunction: true,
          isFunctionDeclaration: true,
          isRequired: false,
          constant: false,
          reactive: false,
          params: [
            {
              name: "x",
              type: "number",
              optional: false,
            },
          ],
          returnType: "string", // Should be ignored in favor of @type
        },
      ],
      moduleExports: [],
      slots: [],
      events: [],
      typedefs: [],
      generics: null,
      rest_props: undefined,
    };

    const output = writeTsDefinition(component_api);

    // Verify function signatures are built from @param and @returns
    expect(output).toContain("add: (notification: NotificationData) => string;");
    expect(output).toContain("remove: (id: string) => boolean;");
    expect(output).toContain("getCount: () => number;");
    expect(output).toContain("log: (message: string) => any;");
    expect(output).toContain("update: (id: string, data?: NotificationData) => boolean;");

    // Verify @type takes priority over @param/@returns
    expect(output).toContain("multiply: (a: number, b: number) => number;");
    expect(output).not.toContain("multiply: (x: number) => string;");
  });

  test("generates module export function signatures from @param and @returns with @example", () => {
    const component_api: ComponentDocApi = {
      moduleName: "TestComponent",
      filePath: asNormalizedPath("./src/TestComponent.svelte"),
      syntaxMode: "legacy",
      props: [],
      moduleExports: [
        {
          name: "computeTreeLeafDepth",
          kind: "function",
          type: "() => any", // Default type
          isFunction: true,
          isFunctionDeclaration: true,
          isRequired: false,
          constant: false,
          reactive: false,
          params: [
            {
              name: "node",
              type: "HTMLLIElement",
              description: "The list item element representing the tree node",
              optional: false,
            },
          ],
          returnType: "number",
          description:
            "Computes the depth of a tree leaf node relative to <ul role=\"tree\" />\n@example\n```svelte\nimport { computeTreeLeafDepth } from 'carbon-components-svelte/TreeView/TreeViewNode.svelte';\nlet nodeElement;\n$: depth = computeTreeLeafDepth(nodeElement);\n<li bind:this={nodeElement}>Node at depth {depth}</li>\n```",
        },
      ],
      slots: [],
      events: [],
      typedefs: [],
      generics: null,
      rest_props: undefined,
    };

    const output = writeTsDefinition(component_api);

    // Verify function signature is built from @param and @returns
    expect(output).toContain("export declare function computeTreeLeafDepth(node: HTMLLIElement): number;");

    // Verify description with @example is preserved
    expect(output).toContain('Computes the depth of a tree leaf node relative to <ul role="tree" />');
    expect(output).toContain("@example");
    expect(output).toContain("```svelte");
  });

  test("generates snippet props for named slots (Svelte 5 compatibility)", () => {
    const component_api: ComponentDocApi = {
      moduleName: "CardComponent",
      filePath: asNormalizedPath("./src/CardComponent.svelte"),
      syntaxMode: "legacy",
      props: [
        {
          name: "title",
          kind: "let",
          type: "string",
          value: '""',
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: false,
        },
      ],
      moduleExports: [],
      slots: [
        {
          name: null,
          default: true,
          fallback: "Default content",
          slot_props: "Record<string, never>",
        },
        {
          name: "header",
          default: false,
          slot_props: "{ title: string }",
          description: "Header slot for custom header content",
        },
        {
          name: "footer",
          default: false,
          slot_props: "Record<string, never>",
        },
        {
          name: "bold heading",
          default: false,
          slot_props: "Record<string, never>",
          description: "Slot with space in name",
        },
        {
          // This slot has the same name as a prop - should NOT generate a snippet prop
          name: "title",
          default: false,
          slot_props: "{ text: string }",
        },
      ],
      events: [],
      typedefs: [],
      generics: null,
      rest_props: undefined,
    };

    const output = writeTsDefinition(component_api);

    // Named slots with slot_props should generate Snippet-compatible typed callback props
    expect(output).toContain("header?: (this: void, ...args: [{ title: string }]) => void;");
    // Named slots without slot_props (Record<string, never>) should use (this: void) => void
    expect(output).toContain("footer?: (this: void) => void;");

    // Slot names with special characters should be quoted
    expect(output).toContain('"bold heading"?: (this: void) => void;');

    // Default slot should NOT generate a snippet prop
    expect(output).not.toMatch(DEFAULT_SLOT_SNIPPET_PROP_REGEX);

    // Slots with same name as existing props should NOT generate duplicate props
    // The prop 'title' already exists as string, so no snippet prop should be added
    expect(output).toContain("title?: string;");
    expect(output).not.toContain("title?: (this: void) => void;");
    expect(output).not.toContain("title?: (this: void, ...args:");

    // Slot descriptions should be included as JSDoc comments
    expect(output).toContain("/** Header slot for custom header content */");
    expect(output).toContain("/** Slot with space in name */");

    // Slots should still be in the Slots generic parameter
    expect(output).toContain("header: { title: string }");
    expect(output).toContain("footer: Record<string, never>");
  });

  test("snippet props with no regular props", () => {
    const component_api: ComponentDocApi = {
      moduleName: "SlotOnlyComponent",
      filePath: asNormalizedPath("./src/SlotOnlyComponent.svelte"),
      syntaxMode: "legacy",
      props: [],
      moduleExports: [],
      slots: [
        {
          name: "content",
          default: false,
          slot_props: "Record<string, never>",
        },
      ],
      events: [],
      typedefs: [],
      generics: null,
      rest_props: undefined,
    };

    const output = writeTsDefinition(component_api);

    // Should generate snippet prop even when there are no regular props
    expect(output).toContain("content?: (this: void) => void;");
    // Props type should not be Record<string, never> since we have snippet props
    expect(output).not.toContain("SlotOnlyComponentProps = Record<string, never>");
  });

  test("imports Snippet when prop types reference it directly", () => {
    const component_api: ComponentDocApi = {
      moduleName: "RunesTable",
      filePath: asNormalizedPath("./src/RunesTable.svelte"),
      syntaxMode: "legacy",
      props: [
        {
          name: "row",
          kind: "let",
          type: "Snippet<[item: string, index: number]>",
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: true,
          constant: false,
          reactive: false,
        },
      ],
      moduleExports: [],
      slots: [],
      events: [],
      typedefs: [],
      generics: null,
      rest_props: undefined,
    };

    const output = writeTsDefinition(component_api);
    expect(output).toContain('import { SvelteComponentTyped, type Snippet } from "svelte";');
    expect(output).toContain("row: Snippet<[item: string, index: number]>;");
  });

  test("preserves canonical props types with local declarations and type-only imports", () => {
    const component_api: ComponentDocApi = {
      moduleName: "TypedButton",
      filePath: asNormalizedPath("./src/TypedButton.svelte"),
      syntaxMode: "legacy",
      props: [
        {
          name: "disabled",
          kind: "let",
          type: "boolean",
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: false,
        },
      ],
      moduleExports: [],
      slots: [],
      events: [],
      typedefs: [],
      generics: null,
      rest_props: undefined,
    };

    component_api[PARSED_COMPONENT_TYPE_SCRIPT_METADATA] = {
      canonicalPropsType: "HTMLButtonAttributes & Props",
      canonicalPropNames: ["disabled"],
      localTypeDeclarations: [
        `interface Props {
  disabled?: boolean;
}`,
      ],
      typeImportStatements: ['import type { HTMLButtonAttributes } from "svelte/elements";'],
    };

    const output = writeTsDefinition(component_api);
    expect(output).toContain('import type { HTMLButtonAttributes } from "svelte/elements";');
    expect(output).toContain("interface Props");
    expect(output).toContain("type $Props = HTMLButtonAttributes & Props;");
    expect(output).toContain("export type TypedButtonProps = $Props;");
  });
});

describe(`writeTsDefinition with format: "component"`, () => {
  test("plain props component emits declare const with Component<Props>", () => {
    const component_api: ComponentDocApi = {
      moduleName: "Button",
      filePath: asNormalizedPath("./src/Button.svelte"),
      syntaxMode: "runes",
      props: [
        {
          name: "label",
          kind: "let",
          type: "string",
          value: '""',
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: false,
        },
      ],
      moduleExports: [],
      slots: [],
      events: [],
      typedefs: [],
      generics: null,
      rest_props: undefined,
    };

    const output = writeTsDefinition(component_api, { format: "component" });
    expect(output).toContain('import type { Component } from "svelte";');
    expect(output).not.toContain("SvelteComponentTyped");
    expect(output).toContain("export type ButtonExports = Record<string, never>;");
    expect(output).toContain(
      `declare const Button: Component<
  ButtonProps,
  ButtonExports,
  ""
>;
export default Button;`,
    );
  });

  test('$bindable props populate the Bindings union; none produces ""', () => {
    const bindableComponent: ComponentDocApi = {
      moduleName: "TextInput",
      filePath: asNormalizedPath("./src/TextInput.svelte"),
      syntaxMode: "runes",
      props: [
        {
          name: "value",
          kind: "let",
          bindable: true,
          type: "string",
          value: '""',
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: true,
        },
        {
          name: "disabled",
          kind: "let",
          binding: "writable",
          type: "boolean",
          value: "false",
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: false,
        },
        {
          name: "label",
          kind: "let",
          type: "string",
          value: '""',
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: false,
        },
      ],
      moduleExports: [],
      slots: [],
      events: [],
      typedefs: [],
      generics: null,
      rest_props: undefined,
    };

    const output = writeTsDefinition(bindableComponent, {
      format: "component",
    });
    expect(output).toContain('"value" | "disabled"');

    const noBindableComponent: ComponentDocApi = {
      ...bindableComponent,
      props: bindableComponent.props.map(({ bindable: _bindable, binding: _binding, ...prop }) => prop),
    };
    const noBindableOutput = writeTsDefinition(noBindableComponent, {
      format: "component",
    });
    expect(noBindableOutput).toContain(
      `declare const TextInput: Component<
  TextInputProps,
  TextInputExports,
  ""
>;`,
    );
  });

  test("legacy dispatched and forwarded events become on* callback props", () => {
    const component_api: ComponentDocApi = {
      moduleName: "Modal",
      filePath: asNormalizedPath("./src/Modal.svelte"),
      syntaxMode: "legacy",
      props: [],
      moduleExports: [],
      slots: [],
      events: [
        { type: "dispatched", name: "close", detail: "{ id: string }" },
        {
          type: "forwarded",
          name: "click",
          element: "button",
        },
      ],
      typedefs: [],
      generics: null,
      rest_props: undefined,
    };

    const output = writeTsDefinition(component_api, { format: "component" });
    expect(output).toContain("onclose?: (event: CustomEvent<{ id: string }>) => void;");
    expect(output).toContain('onclick?: (event: WindowEventMap["click"]) => void;');
  });

  test("does not add on* callback props for runes components", () => {
    const component_api: ComponentDocApi = {
      moduleName: "RunesButton",
      filePath: asNormalizedPath("./src/RunesButton.svelte"),
      syntaxMode: "runes",
      props: [
        {
          name: "onclick",
          kind: "let",
          type: "(event: MouseEvent) => void",
          isFunction: true,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: false,
        },
      ],
      moduleExports: [],
      slots: [],
      events: [{ type: "dispatched", name: "close", detail: "{ id: string }" }],
      typedefs: [],
      generics: null,
      rest_props: undefined,
    };

    const output = writeTsDefinition(component_api, { format: "component" });
    expect(output).not.toContain("onclose");
  });

  test("exported accessors populate the Exports shape", () => {
    const component_api: ComponentDocApi = {
      moduleName: "Tree",
      filePath: asNormalizedPath("./src/Tree.svelte"),
      syntaxMode: "legacy",
      props: [
        {
          name: "expandAll",
          kind: "function",
          type: "() => any",
          isFunction: true,
          isFunctionDeclaration: true,
          isRequired: false,
          constant: false,
          reactive: false,
          returnType: "void",
        },
      ],
      moduleExports: [],
      slots: [],
      events: [],
      typedefs: [],
      generics: null,
      rest_props: undefined,
    };

    const output = writeTsDefinition(component_api, { format: "component" });
    expect(output).toContain("export type TreeExports = {");
    expect(output).toContain("expandAll: () => void;");
    expect(output).toContain(
      `declare const Tree: Component<
  TreeProps,
  TreeExports,
  ""
>;`,
    );
  });

  test("generic components emit an interface with a generic call signature", () => {
    const component_api: ComponentDocApi = {
      moduleName: "GenericList",
      filePath: asNormalizedPath("./src/GenericList.svelte"),
      syntaxMode: "runes",
      props: [
        {
          name: "items",
          kind: "let",
          type: "Row[]",
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: true,
          constant: false,
          reactive: false,
        },
      ],
      moduleExports: [],
      slots: [],
      events: [],
      typedefs: [],
      generics: ["Row", "Row extends { id: string } = { id: string }"],
      rest_props: undefined,
    };

    const output = writeTsDefinition(component_api, { format: "component" });
    expect(output).not.toContain("SvelteComponentTyped");
    expect(output).toContain(
      'import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";',
    );
    expect(output).toContain("interface GenericListComponent {");
    expect(output).toContain(
      "new <Row extends { id: string } = { id: string }>(\n    options: ComponentConstructorOptions<GenericListProps<Row>>\n  ): SvelteComponent<GenericListProps<Row>> & GenericListExports;",
    );
    expect(output).toContain(
      "<Row extends { id: string } = { id: string }>(\n    this: void,\n    internals: ComponentInternals,\n    props: GenericListProps<Row>",
    );
    expect(output).toContain("declare const GenericList: GenericListComponent;");
    expect(output).toContain("export default GenericList;");
  });

  test("generic Exports type is parameterized only when it references the generic", () => {
    const component_api: ComponentDocApi = {
      moduleName: "GenericTree",
      filePath: asNormalizedPath("./src/GenericTree.svelte"),
      syntaxMode: "legacy",
      props: [
        {
          name: "getSelected",
          kind: "function",
          type: "() => any",
          isFunction: true,
          isFunctionDeclaration: true,
          isRequired: false,
          constant: false,
          reactive: false,
          returnType: "Row[]",
        },
      ],
      moduleExports: [],
      slots: [],
      events: [],
      typedefs: [],
      generics: ["Row", "Row extends { id: string } = { id: string }"],
      rest_props: undefined,
    };

    const output = writeTsDefinition(component_api, { format: "component" });
    expect(output).toContain("export type GenericTreeExports<Row extends { id: string } = { id: string }> = {");
    expect(output).toContain("getSelected: () => Row[];");
    expect(output).toContain("props: GenericTreeProps<Row>");
    expect(output).toContain("} & GenericTreeExports<Row>;");
  });
});

describe("writeTsDefinitions", () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    setQuiet(false);
    jest.restoreAllMocks();
  });

  test("prints the progress line to stderr", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-ts-defs-"));
    const outDir = path.relative(process.cwd(), tempDir);
    const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);

    try {
      await writeTsDefinitions(components, {
        outDir,
        inputDir: "src",
        preamble: "",
        exports: mockParsedExports({}),
      });

      expect(errorSpy).toHaveBeenCalledWith("created TypeScript definitions.");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("suppresses the progress line when quiet mode is on", async () => {
    setQuiet(true);
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-ts-defs-"));
    const outDir = path.relative(process.cwd(), tempDir);
    const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);

    try {
      await writeTsDefinitions(components, {
        outDir,
        inputDir: "src",
        preamble: "",
        exports: mockParsedExports({}),
      });

      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("typesOptions.exportTypes", () => {
  test("exportTypes: false hides every generated export keyword except module exports and export default", () => {
    const component_api: ComponentDocApi = {
      moduleName: "Widget",
      filePath: asNormalizedPath("./src/Widget.svelte"),
      syntaxMode: "legacy",
      props: [
        {
          name: "label",
          kind: "let",
          type: "string",
          value: '""',
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: false,
        },
      ],
      moduleExports: [
        {
          name: "VERSION",
          kind: "const",
          type: "string",
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: true,
          reactive: false,
        },
      ],
      slots: [],
      events: [],
      typedefs: [
        {
          type: "{ [key: string]: boolean; }",
          name: "MyTypedef",
          ts: "interface MyTypedef { [key: string]: boolean; }",
        },
      ],
      generics: null,
      rest_props: undefined,
      contexts: [
        {
          key: "simple-modal",
          typeName: "SimpleModalContext",
          properties: [{ name: "open", type: "() => void", optional: false }],
        },
      ],
    };

    const output = writeTsDefinition(component_api, { exportTypes: false });

    expect(output).not.toContain("export type");
    expect(output).not.toContain("export interface");
    expect(output).toContain("export declare const VERSION: string;");
    expect(output).toContain("export default class Widget");
  });

  test('exportTypes: { props: false } on format: "component" keeps Exports exported', () => {
    const component_api: ComponentDocApi = {
      moduleName: "Tree",
      filePath: asNormalizedPath("./src/Tree.svelte"),
      syntaxMode: "legacy",
      props: [
        {
          name: "expandAll",
          kind: "function",
          type: "() => any",
          isFunction: true,
          isFunctionDeclaration: true,
          isRequired: false,
          constant: false,
          reactive: false,
          returnType: "void",
        },
      ],
      moduleExports: [],
      slots: [],
      events: [],
      typedefs: [],
      generics: null,
      rest_props: undefined,
    };

    const output = writeTsDefinition(component_api, { format: "component", exportTypes: { props: false } });

    expect(output).toContain("type TreeProps = Record<string, never>;");
    expect(output).not.toContain("export type TreeProps");
    expect(output).toContain("export type TreeExports = {");
    expect(output).toContain(
      `declare const Tree: Component<
  TreeProps,
  TreeExports,
  ""
>;`,
    );
  });

  test("forceExportProps: true overrides exportTypes: false, exporting only the props type", () => {
    const component_api: ComponentDocApi = {
      moduleName: "Button",
      filePath: asNormalizedPath("./src/Button.svelte"),
      syntaxMode: "legacy",
      props: [
        {
          name: "label",
          kind: "let",
          type: "string",
          value: '""',
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: false,
        },
      ],
      moduleExports: [],
      slots: [],
      events: [],
      typedefs: [
        {
          type: "{ [key: string]: boolean; }",
          name: "MyTypedef",
          ts: "interface MyTypedef { [key: string]: boolean; }",
        },
      ],
      generics: null,
      rest_props: undefined,
    };

    const output = writeTsDefinition(component_api, { exportTypes: false, forceExportProps: true });

    expect(output).toContain("export type ButtonProps");
    expect(output).toContain("interface MyTypedef");
    expect(output).not.toContain("export interface MyTypedef");
  });

  test("writeTsDefinitions keeps an @extends target's props type exported under exportTypes: false", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-ts-defs-export-types-"));
    const outDir = path.relative(process.cwd(), tempDir);

    const componentA = mockComponentDocApi("A", "A.svelte", {
      props: [
        {
          name: "variant",
          kind: "let",
          type: "string",
          value: '"primary"',
          isFunction: false,
          isFunctionDeclaration: false,
          isRequired: false,
          constant: false,
          reactive: false,
        },
      ],
    });
    const componentB = mockComponentDocApi("B", "B.svelte", {
      extends: { interface: "AProps", import: '"./A.svelte"' },
    });

    const components: ComponentDocs = new Map([
      ["A", componentA],
      ["B", componentB],
    ]);

    try {
      await writeTsDefinitions(components, {
        outDir,
        inputDir: "src",
        preamble: "",
        exports: mockParsedExports({}),
        exportTypes: false,
      });

      const aDts = readFileSync(path.join(tempDir, "A.svelte.d.ts"), "utf-8");
      const bDts = readFileSync(path.join(tempDir, "B.svelte.d.ts"), "utf-8");

      expect(aDts).toContain("export type AProps");
      expect(bDts).not.toContain("export type BProps");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("typesOptions.typeNames", () => {
  test("propsTypeName defaults to <Name>Props", () => {
    expect(propsTypeName("Button", undefined)).toEqual("ButtonProps");
  });

  test("propsTypeName substitutes {name} in a custom template", () => {
    expect(propsTypeName("Button", { props: "I{name}Props" })).toEqual("IButtonProps");
  });

  test("exportsTypeName defaults to <Name>Exports", () => {
    expect(exportsTypeName("Button", undefined)).toEqual("ButtonExports");
  });

  test("exportsTypeName substitutes {name} in a custom template", () => {
    expect(exportsTypeName("Button", { exports: "{name}Api" })).toEqual("ButtonApi");
  });

  test("propsTypeName throws when the template omits {name}", () => {
    expect(() => propsTypeName("Button", { props: "FixedProps" })).toThrow(
      'sveld: typesOptions.typeNames.props must contain "{name}" and produce a valid identifier; got "FixedProps".',
    );
  });

  test("propsTypeName throws when the substituted result is not a valid identifier", () => {
    expect(() => propsTypeName("Button", { props: "{name}-Props" })).toThrow(
      'sveld: typesOptions.typeNames.props must contain "{name}" and produce a valid identifier; got "{name}-Props".',
    );
  });

  test('writeTsDefinition applies typeNames templates for "component" format', () => {
    const component_api = mockComponentDocApi("Button", "./src/Button.svelte");

    const output = writeTsDefinition(component_api, {
      format: "component",
      typeNames: { props: "I{name}Props", exports: "{name}Api" },
    });

    expect(output).toContain("export type IButtonProps");
    expect(output).toContain(
      `declare const Button: Component<
  IButtonProps,
  ButtonApi,
  ""
>;`,
    );
  });
});

describe("serializeEmitOptions", () => {
  test(`undefined, {}, and { format: "class" } all produce the same key`, () => {
    const undefinedKey = serializeEmitOptions(undefined);
    const emptyKey = serializeEmitOptions({});
    const explicitClassKey = serializeEmitOptions({ format: "class" });

    expect(emptyKey).toEqual(undefinedKey);
    expect(explicitClassKey).toEqual(undefinedKey);
  });

  test("a different format produces a different key", () => {
    expect(serializeEmitOptions({ format: "component" })).not.toEqual(serializeEmitOptions({ format: "class" }));
  });

  test("a different typeNames template produces a different key", () => {
    expect(serializeEmitOptions({ typeNames: { props: "I{name}Props" } })).not.toEqual(serializeEmitOptions({}));
  });
});

describe("pickEmitOptions", () => {
  test("keeps only pure emit options, dropping writer-only fields", () => {
    const options: WriteTsDefinitionsOptions = {
      format: "component",
      outDir: "./dist",
      inputDir: "./src",
      preamble: "// preamble\n",
      exports: mockParsedExports({}),
      cache: new ParseCache(path.join(process.cwd(), ".tmp-sveld-pick-emit-options-nonexistent-cache.json")),
      dryRun: true,
      resolvedPathByFilePath: new Map(),
    };

    expect(pickEmitOptions(options)).toEqual({ format: "component" });
  });
});

describe("typesOptions.comments", () => {
  const commentsTestComponent: ComponentDocApi = {
    moduleName: "Widget",
    filePath: asNormalizedPath("./src/Widget.svelte"),
    syntaxMode: "legacy",
    componentComment: "A widget component.",
    props: [
      {
        name: "label",
        kind: "let",
        type: "string",
        value: '""',
        description: "The visible label.",
        deprecated: "Use `text` instead.",
        tags: [{ name: "since", body: "1.2.0" }],
        isFunction: false,
        isFunctionDeclaration: false,
        isRequired: false,
        constant: false,
        reactive: false,
      },
    ],
    moduleExports: [
      {
        name: "VERSION",
        kind: "const",
        type: "string",
        description: "The package version.",
        isFunction: false,
        isFunctionDeclaration: false,
        isRequired: false,
        constant: true,
        reactive: false,
      },
    ],
    slots: [],
    events: [],
    typedefs: [
      {
        type: "{ [key: string]: boolean; }",
        name: "MyTypedef",
        description: "A typedef description.",
        tags: [{ name: "see", body: "https://example.com" }],
        ts: "interface MyTypedef { [key: string]: boolean; }",
      },
    ],
    generics: null,
    rest_props: undefined,
    contexts: [
      {
        key: "simple-modal",
        typeName: "SimpleModalContext",
        description: "The simple modal context.",
        properties: [{ name: "open", type: "() => void", optional: false }],
      },
    ],
  };

  test('"all" equals the output with `comments` omitted', () => {
    expect(writeTsDefinition(commentsTestComponent, { comments: "all" })).toEqual(
      writeTsDefinition(commentsTestComponent),
    );
  });

  test('"descriptions" keeps descriptions and @deprecated, drops @default and passthrough tags', () => {
    const output = writeTsDefinition(commentsTestComponent, { comments: "descriptions" });

    expect(output).toContain("The visible label.");
    expect(output).toContain("The package version.");
    expect(output).toContain("A typedef description.");
    expect(output).toContain("The simple modal context.");
    expect(output).toContain("A widget component.");
    expect(output).toContain("@deprecated");
    expect(output).not.toContain("@default");
    expect(output).not.toContain("@since");
    expect(output).not.toContain("@see");
  });

  test('"none" emits no comments at all, keeping declarations unchanged', () => {
    const output = writeTsDefinition(commentsTestComponent, { comments: "none" });

    expect(output).not.toContain("/**");
    expect(output).not.toContain("The visible label.");
    expect(output).not.toContain("A widget component.");
    expect(output).toContain("label?: string;");
    expect(output).toContain("interface MyTypedef {");
    expect(output).toContain("export declare const VERSION: string;");
    expect(output).toContain("type SimpleModalContext = {");
  });

  test("a different comments level produces a different serializeEmitOptions key", () => {
    expect(serializeEmitOptions({ comments: "none" })).not.toEqual(serializeEmitOptions({}));
  });

  test("pickEmitOptions keeps comments", () => {
    const options: WriteTsDefinitionsOptions = {
      comments: "descriptions",
      outDir: "./dist",
      inputDir: "./src",
      preamble: "",
      exports: mockParsedExports({}),
    };

    expect(pickEmitOptions(options)).toEqual({ comments: "descriptions" });
  });

  test('"none" produces no comment for a real component with a typedef', async () => {
    const filePath = path.join(process.cwd(), "tests", "fixtures", "typedef-description", "input.svelte");
    const source = await Bun.file(filePath).text();
    const parser = new ComponentParser();
    const parsed_component = parser.parseSvelteComponent(source, {
      filePath: "typedef-description/input.svelte",
      moduleName: "TypedefDescription",
    });
    const component = {
      moduleName: "TypedefDescription",
      filePath: asNormalizedPath("typedef-description/input.svelte"),
      ...parsed_component,
    };

    const output = writeTsDefinition(component, { comments: "none" });

    expect(output).not.toContain("/**");
  });

  test('"none" produces no comment for a real component with a context', async () => {
    const filePath = path.join(process.cwd(), "tests", "fixtures", "context-typedef", "input.svelte");
    const source = await Bun.file(filePath).text();
    const parser = new ComponentParser();
    const parsed_component = parser.parseSvelteComponent(source, {
      filePath: "context-typedef/input.svelte",
      moduleName: "ContextTypedef",
    });
    const component = {
      moduleName: "ContextTypedef",
      filePath: asNormalizedPath("context-typedef/input.svelte"),
      ...parsed_component,
    };

    const output = writeTsDefinition(component, { comments: "none" });

    expect(output).not.toContain("/**");
  });
});

describe("typesOptions.propsDeclaration", () => {
  const labelProp = {
    name: "label",
    kind: "let",
    type: "string",
    value: '""',
    isFunction: false,
    isFunctionDeclaration: false,
    isRequired: false,
    constant: false,
    reactive: false,
  } as ComponentDocApi["props"][number];

  test('"type" (default) emits a type alias for plain props', () => {
    const component = mockComponentDocApi("Widget", "./src/Widget.svelte", { props: [labelProp] });

    expect(writeTsDefinition(component)).toContain("export type WidgetProps = {");
  });

  test('"interface" emits an interface for plain props', () => {
    const component = mockComponentDocApi("Widget", "./src/Widget.svelte", { props: [labelProp] });

    const output = writeTsDefinition(component, { propsDeclaration: "interface" });

    expect(output).toContain("export interface WidgetProps {");
    expect(output).not.toContain("export type WidgetProps");
  });

  test('"interface" on a generic component parameterizes the interface', () => {
    const component = mockComponentDocApi("Widget", "./src/Widget.svelte", {
      props: [labelProp],
      generics: ["T", 'T extends string = "a"'],
    });

    const output = writeTsDefinition(component, { propsDeclaration: "interface" });

    expect(output).toContain('export interface WidgetProps<T extends string = "a"> {');
  });

  test('combined with exportTypes: { props: false } drops "export" but keeps "interface"', () => {
    const component = mockComponentDocApi("Widget", "./src/Widget.svelte", { props: [labelProp] });

    const output = writeTsDefinition(component, { propsDeclaration: "interface", exportTypes: { props: false } });

    expect(output).toContain("interface WidgetProps {");
    expect(output).not.toContain("export interface WidgetProps");
  });

  test("a component with @restProps stays a type alias regardless of propsDeclaration", () => {
    const component = mockComponentDocApi("Widget", "./src/Widget.svelte", {
      props: [labelProp],
      rest_props: { type: "Element", name: "div" },
    });

    const typeOutput = writeTsDefinition(component, { propsDeclaration: "type" });
    const interfaceOutput = writeTsDefinition(component, { propsDeclaration: "interface" });

    expect(interfaceOutput).toEqual(typeOutput);
    expect(interfaceOutput).toContain("export type WidgetProps = Omit<$RestProps");
  });

  test("a component with @extends stays a type alias regardless of propsDeclaration", () => {
    const component = mockComponentDocApi("Widget", "./src/Widget.svelte", {
      props: [labelProp],
      extends: { interface: "ButtonProps", import: '"./Button.svelte"' },
    });

    const typeOutput = writeTsDefinition(component, { propsDeclaration: "type" });
    const interfaceOutput = writeTsDefinition(component, { propsDeclaration: "interface" });

    expect(interfaceOutput).toEqual(typeOutput);
    expect(interfaceOutput).toContain("export type WidgetProps = Omit<ButtonProps");
  });

  test("a whole-object $props() canonical type stays a type alias regardless of propsDeclaration", () => {
    const component = mockComponentDocApi("TypedButton", "./src/TypedButton.svelte", { props: [labelProp] });
    component[PARSED_COMPONENT_TYPE_SCRIPT_METADATA] = {
      canonicalPropsType: "HTMLButtonAttributes & Props",
      canonicalPropNames: ["label"],
      localTypeDeclarations: [
        `interface Props {
  label?: string;
}`,
      ],
      typeImportStatements: ['import type { HTMLButtonAttributes } from "svelte/elements";'],
    };

    const typeOutput = writeTsDefinition(component, { propsDeclaration: "type" });
    const interfaceOutput = writeTsDefinition(component, { propsDeclaration: "interface" });

    expect(interfaceOutput).toEqual(typeOutput);
    expect(interfaceOutput).toContain("export type TypedButtonProps = $Props;");
  });

  test("zero props stays a type alias (Record<string, never>) regardless of propsDeclaration", () => {
    const component = mockComponentDocApi("Empty", "./src/Empty.svelte");

    const typeOutput = writeTsDefinition(component, { propsDeclaration: "type" });
    const interfaceOutput = writeTsDefinition(component, { propsDeclaration: "interface" });

    expect(interfaceOutput).toEqual(typeOutput);
    expect(interfaceOutput).toContain("export type EmptyProps = Record<string, never>;");
  });

  test("a different propsDeclaration produces a different serializeEmitOptions key", () => {
    expect(serializeEmitOptions({ propsDeclaration: "interface" })).not.toEqual(serializeEmitOptions({}));
  });

  test("pickEmitOptions keeps propsDeclaration", () => {
    const options: WriteTsDefinitionsOptions = {
      propsDeclaration: "interface",
      outDir: "./dist",
      inputDir: "./src",
      preamble: "",
      exports: mockParsedExports({}),
    };

    expect(pickEmitOptions(options)).toEqual({ propsDeclaration: "interface" });
  });

  test("parsed fixtures emit valid TypeScript under `interface`, verified with tsc", async () => {
    const parser = new ComponentParser();

    const typedefSource = await Bun.file(
      path.join(process.cwd(), "tests", "fixtures", "typedef-description", "input.svelte"),
    ).text();
    const typedefParsed = parser.parseSvelteComponent(typedefSource, {
      filePath: "typedef-description/input.svelte",
      moduleName: "TypedefDescription",
    });
    const typedefComponent = {
      moduleName: "TypedefDescription",
      filePath: asNormalizedPath("typedef-description/input.svelte"),
      ...typedefParsed,
    };
    const typedefOutput = writeTsDefinition(typedefComponent, { propsDeclaration: "interface" });
    expect(typedefOutput).toContain("export interface TypedefDescriptionProps {");

    const restPropsSource = await Bun.file(
      path.join(process.cwd(), "tests", "fixtures", "rest-props-multiple", "input.svelte"),
    ).text();
    const restPropsParsed = parser.parseSvelteComponent(restPropsSource, {
      filePath: "rest-props-multiple/input.svelte",
      moduleName: "RestPropsMultiple",
    });
    const restPropsComponent = {
      moduleName: "RestPropsMultiple",
      filePath: asNormalizedPath("rest-props-multiple/input.svelte"),
      ...restPropsParsed,
    };
    const restPropsOutput = writeTsDefinition(restPropsComponent, { propsDeclaration: "interface" });
    // @restProps stays a type alias even under propsDeclaration: "interface".
    expect(restPropsOutput).toContain("export type RestPropsMultipleProps = Omit<$RestProps");

    // Reuse tsconfig.fixtures.json's compiler options so a shape mistake here
    // is caught as a real type error, not just a string mismatch.
    const configPath = path.join(process.cwd(), "tsconfig.fixtures.json");
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));

    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-props-declaration-tsc-"));
    try {
      const typedefFilePath = path.join(tempDir, "typedef-description.d.ts");
      const restPropsFilePath = path.join(tempDir, "rest-props-multiple.d.ts");
      writeFileSync(typedefFilePath, typedefOutput);
      writeFileSync(restPropsFilePath, restPropsOutput);

      const program = ts.createProgram([typedefFilePath, restPropsFilePath], parsedConfig.options);
      const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) =>
        ts.formatDiagnostic(diagnostic, {
          getCanonicalFileName: (fileName) => fileName,
          getCurrentDirectory: () => tempDir,
          getNewLine: () => "\n",
        }),
      );

      expect(diagnostics).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("typesOptions.transform", () => {
  test("transforms both the component file and index.d.ts, recording each context", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-ts-defs-transform-"));
    const outDir = path.relative(process.cwd(), tempDir);
    const component = mockComponentDocApi("Button", "Button.svelte");
    const components: ComponentDocs = new Map([["Button", component]]);
    const seenContexts: TransformContext[] = [];

    try {
      await writeTsDefinitions(components, {
        outDir,
        inputDir: "src",
        preamble: "",
        exports: mockParsedExports({}),
        transform: async (text, context) => {
          seenContexts.push(context);
          return `// x\n${text}`;
        },
      });

      const componentDts = readFileSync(path.join(tempDir, "Button.svelte.d.ts"), "utf-8");
      const indexDts = readFileSync(path.join(tempDir, "index.d.ts"), "utf-8");

      expect(componentDts.startsWith("// x\n")).toBe(true);
      expect(indexDts.startsWith("// x\n")).toBe(true);

      expect(seenContexts).toHaveLength(2);
      const componentContext = seenContexts.find((context) => context.kind === "component");
      const indexContext = seenContexts.find((context) => context.kind === "index");

      expect(componentContext).toEqual({ kind: "component", component, filePath: "Button.svelte.d.ts" });
      expect(indexContext).toEqual({ kind: "index", filePath: "index.d.ts" });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // These error-path tests run under `dryRun: true` so the write phase never
  // touches disk: with a mix of a rejecting (component) and a resolving
  // (index) write promise, `Promise.all` settles as soon as the first one
  // rejects while the other keeps running in the background, so a real write
  // could still land on disk (or recreate a just-removed temp dir) after the
  // test's cleanup already ran.
  test("a throwing transform rejects with a message naming the failing file", async () => {
    const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);

    await expect(
      writeTsDefinitions(components, {
        outDir: "types",
        inputDir: "src",
        preamble: "",
        exports: mockParsedExports({}),
        dryRun: true,
        transform: (text, context) => {
          if (context.kind === "component") throw new Error("boom");
          return text;
        },
      }),
    ).rejects.toThrow('sveld: typesOptions.transform failed for "Button.svelte.d.ts": boom');
  });

  test("a transform returning a non-string rejects with a message naming the failing file", async () => {
    const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);

    await expect(
      writeTsDefinitions(components, {
        outDir: "types",
        inputDir: "src",
        preamble: "",
        exports: mockParsedExports({}),
        dryRun: true,
        // biome-ignore lint/suspicious/noExplicitAny: intentionally violating the return type to test the guard
        transform: (text, context) => (context.kind === "component" ? (undefined as any) : text),
      }),
    ).rejects.toThrow('sveld: typesOptions.transform failed for "Button.svelte.d.ts"');
  });

  test("dry run still calls the transform for every generated file, without writing anything", async () => {
    const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);
    const seenContexts: TransformContext[] = [];

    await writeTsDefinitions(components, {
      outDir: "types",
      inputDir: "src",
      preamble: "",
      exports: mockParsedExports({}),
      dryRun: true,
      transform: (text, context) => {
        seenContexts.push(context);
        return text;
      },
    });

    expect(seenContexts.map((context) => context.kind).sort()).toEqual(["component", "index"]);
  });

  test("second run's output reflects the second transform even on a generated-text cache hit", async () => {
    const dir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-ts-defs-transform-cache-src-"));
    const outDirAbs = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-ts-defs-transform-cache-out-"));
    const outDir = path.relative(process.cwd(), outDirAbs);
    const cacheFile = path.join(dir, ".cache", "parse-cache.json");
    writeFileSync(
      path.join(dir, "Button.svelte"),
      `<script>\n  export let label = "";\n</script>\n\n<button>{label}</button>`,
    );

    try {
      const first = await generateBundle(dir, true, { cache: cacheFile });
      await writeTsDefinitions(first.allComponentsForTypes, {
        outDir,
        inputDir: dir,
        preamble: "",
        exports: first.exports,
        cache: first.cache,
        resolvedPathByFilePath: first.resolvedPathByFilePath,
        transform: (text) => `// first\n${text}`,
      });
      first.cache?.save();

      const firstOutput = readFileSync(path.join(outDirAbs, "Button.svelte.d.ts"), "utf-8");
      expect(firstOutput.startsWith("// first\n")).toBe(true);

      // The cache stores the untransformed text, not the transformed output.
      const buttonPath = path.resolve(dir, "Button.svelte");
      const cacheKey = serializeEmitOptions({});
      expect(first.cache?.getGeneratedText(buttonPath, cacheKey)).toBeDefined();
      expect(first.cache?.getGeneratedText(buttonPath, cacheKey)).not.toContain("// first");

      const second = await generateBundle(dir, true, { cache: cacheFile });
      await writeTsDefinitions(second.allComponentsForTypes, {
        outDir,
        inputDir: dir,
        preamble: "",
        exports: second.exports,
        cache: second.cache,
        resolvedPathByFilePath: second.resolvedPathByFilePath,
        transform: (text) => `// second\n${text}`,
      });

      const secondOutput = readFileSync(path.join(outDirAbs, "Button.svelte.d.ts"), "utf-8");
      expect(secondOutput.startsWith("// second\n")).toBe(true);
      // The underlying generated text (below the prefix) is unchanged, proving
      // the second run served the cached text and only the transform differed.
      expect(secondOutput.slice("// second\n".length)).toEqual(firstOutput.slice("// first\n".length));
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(outDirAbs, { recursive: true, force: true });
    }
  });
});
