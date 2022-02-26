import { test, expect, describe } from "vitest";
import { writeTsDefinition, formatTsProps, getTypeDefs } from "../src/writer/writer-ts-definitions";
import { ComponentDocApi } from "../src/rollup-plugin";
import { ParsedComponent } from "../src/ComponentParser";

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
      })
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
          constant: false,
          reactive: false,
        },
        {
          name: "name",
          kind: "let",
          type: "string",
          isFunction: false,
          isFunctionDeclaration: false,
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
      rest_props: undefined,
    };

    expect(writeTsDefinition(component_api)).toMatchSnapshot();
  });
});
