import type { ParsedComponent } from "../src/ComponentParser";
import type { ComponentDocApi } from "../src/plugin";
import { formatTsProps, getContextDefs, getTypeDefs, writeTsDefinition } from "../src/writer/writer-ts-definitions";

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
          value: "() => {     localBool = !localBool;   }",
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
      filePath: "./src/ModuleName.svelte",
      ...parsed_output,
    };

    expect(writeTsDefinition(component_api)).toMatchSnapshot();
  });

  test('"default" module name', () => {
    const component_api: ComponentDocApi = {
      moduleName: "default",
      filePath: "./src/ModuleName.svelte",
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

  test("generates function signatures from @param and @returns", () => {
    const component_api: ComponentDocApi = {
      moduleName: "TestComponent",
      filePath: "./src/TestComponent.svelte",
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
      filePath: "./src/TestComponent.svelte",
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
      filePath: "./src/CardComponent.svelte",
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
      filePath: "./src/SlotOnlyComponent.svelte",
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
});
