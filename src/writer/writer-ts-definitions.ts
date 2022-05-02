import * as path from "path";
import { convertSvelteExt, createExports } from "../create-exports";
import { ParsedExports } from "../parse-exports";
import { ComponentDocApi, ComponentDocs } from "../rollup-plugin";
import Writer from "./Writer";

const ANY_TYPE = "any";
const EMPTY_STR = "";

export function formatTsProps(props?: string) {
  if (props === undefined) return ANY_TYPE;
  return props + "\n";
}

export function getTypeDefs(def: Pick<ComponentDocApi, "typedefs">) {
  if (def.typedefs.length === 0) return EMPTY_STR;
  return def.typedefs.map((typedef) => `export ${typedef.ts}`).join("\n\n");
}

function clampKey(key: string) {
  if (/(\-|\s+|\:)/.test(key)) {
    return /(\"|\')/.test(key) ? key : `["${key}"]`;
  }

  return key;
}

function addCommentLine(value: any, returnValue?: any) {
  if (!value) return undefined;
  return `* ${returnValue || value}\n`;
}

function genPropDef(def: Pick<ComponentDocApi, "props" | "rest_props" | "moduleName" | "extends">) {
  const initial_props = def.props
    .filter((prop) => !prop.isFunctionDeclaration && prop.kind !== "const")
    .map((prop) => {
      let defaultValue = prop.value;

      if (typeof prop.value === "string") {
        defaultValue = prop.value.replace(/\s+/g, " ");
      }

      if (prop.value === undefined) {
        defaultValue = "undefined";
      }

      const prop_comments = [
        addCommentLine(prop.description?.replace(/\n/g, "\n* ")),
        addCommentLine(prop.constant, "@constant"),
        `* @default ${defaultValue}\n`,
      ]
        .filter(Boolean)
        .join("");

      let prop_value = prop.constant && !prop.isFunction ? prop.value : prop.type;

      return `
      ${prop_comments.length > 0 ? `/**\n${prop_comments}*/` : EMPTY_STR}
      ${prop.name}?: ${prop_value};`;
    });

  if (def.rest_props?.type === "Element") {
    const elements = def.rest_props?.name.split("|").map((element) => element.replace(/\s+/g, ""));

    if (elements.includes("a")) {
      initial_props.push(
        [
          "\n",
          `
          /**
           * SvelteKit attribute to enable data prefetching
           * if a link is hovered over or touched on mobile.
           * @see https://kit.svelte.dev/docs/a-options#sveltekit-prefetch
           * @default false
           */
           "sveltekit:prefetch"?: boolean;
          `,
          "\n",
          `
          /**
           * SvelteKit attribute to trigger a full page
           * reload after the link is clicked.
           * @see https://kit.svelte.dev/docs/a-options#sveltekit-reload
           * @default false
           */
           "sveltekit:reload"?: boolean;
          `,
          "\n",
          `
          /**
           * SvelteKit attribute to prevent scrolling
           * after the link is clicked.
           * @see https://kit.svelte.dev/docs/a-options#sveltekit-noscroll
           * @default false
           */
           "sveltekit:noscroll"?: boolean;
          `,
        ].join("\n")
      );
    }
  }

  const props = initial_props.join("\n");

  const props_name = `${def.moduleName}Props`;

  let prop_def = EMPTY_STR;

  if (def.rest_props?.type === "Element") {
    const extend_tag_map = def.rest_props.name
      .split("|")
      .map((name) => {
        const element = name.trim();

        if (element === "svg") {
          return "svelte.JSX.SVGAttributes<SVGSVGElement>";
        }

        return `svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["${element}"]>`;
      })
      .join(",");

    prop_def = `
    export interface ${props_name} extends ${
      def.extends !== undefined ? `${def.extends.interface}, ` : ""
    }${extend_tag_map} {
      ${props}
    }
  `;
  } else {
    prop_def = `
    export interface ${props_name} ${def.extends !== undefined ? `extends ${def.extends.interface}` : ""} {
      ${props}
    }
  `;
  }

  return {
    props_name,
    prop_def,
  };
}

function genSlotDef(def: Pick<ComponentDocApi, "slots">) {
  return def.slots
    .map(({ name, slot_props, ...rest }) => {
      const key = rest.default ? "default" : clampKey(name!);
      return `${clampKey(key)}: ${formatTsProps(slot_props)};`;
    })
    .join("\n");
}

function genEventDef(def: Pick<ComponentDocApi, "events">) {
  const createDispatchedEvent = (detail: string = ANY_TYPE) => {
    if (/CustomEvent/.test(detail)) return detail;
    return `CustomEvent<${detail}>`;
  };
  return def.events
    .map((event) => {
      return `${clampKey(event.name)}: ${
        event.type === "dispatched" ? createDispatchedEvent(event.detail) : `WindowEventMap["${event.name}"]`
      };`;
    })
    .join("\n");
}

function genAccessors(def: Pick<ComponentDocApi, "props">) {
  return def.props
    .filter((prop) => prop.isFunctionDeclaration || prop.kind === "const")
    .map((prop) => {
      const prop_comments = [addCommentLine(prop.description?.replace(/\n/g, "\n* "))].filter(Boolean).join("");

      return `
    ${prop_comments.length > 0 ? `/**\n${prop_comments}*/` : EMPTY_STR}
    ${prop.name}: ${prop.type};`;
    })
    .join("\n");
}

function genImports(def: Pick<ComponentDocApi, "extends">) {
  if (def.extends === undefined) return "";
  return `import type { ${def.extends.interface} } from ${def.extends.import};`;
}

function genComponentComment(def: Pick<ComponentDocApi, "componentComment">) {
  if (!def.componentComment) return "";
  if (!/\n/.test(def.componentComment)) return `/** ${def.componentComment.trim()} */`;
  return `/*${def.componentComment
    .split("\n")
    .map((line) => `* ${line}`)
    .join("\n")}\n*/`;
}

function genModuleExports(def: Pick<ComponentDocApi, "moduleExports">) {
  return def.moduleExports
    .map((prop) => {
      const prop_comments = [addCommentLine(prop.description?.replace(/\n/g, "\n* "))].filter(Boolean).join("");

      let type_def = `export type ${prop.name} = ${prop.type || ANY_TYPE};`;

      const is_function = prop.type && /=>/.test(prop.type);

      if (is_function) {
        const [first, second, ...rest] = prop.type!.split("=>");
        const rest_type = rest.map((item) => "=>" + item).join("");

        type_def = `export declare function ${prop.name}${first}:${second}${rest_type};`;
      }

      return `
      ${prop_comments.length > 0 ? `/**\n${prop_comments}*/` : EMPTY_STR}
      ${type_def}`;
    })
    .join("\n");
}

export function writeTsDefinition(component: ComponentDocApi) {
  const {
    moduleName,
    typedefs,
    props,
    moduleExports,
    slots,
    events,
    rest_props,
    extends: _extends,
    componentComment,
  } = component;
  const { props_name, prop_def } = genPropDef({
    moduleName,
    props,
    rest_props,
    extends: _extends,
  });

  return `
  /// <reference types="svelte" />
  import type { SvelteComponentTyped } from "svelte";
  ${genImports({ extends: _extends })}
  ${genModuleExports({ moduleExports })}
  ${getTypeDefs({ typedefs })}
  ${prop_def}
  ${genComponentComment({ componentComment })}
  export default class ${moduleName === "default" ? "" : moduleName} extends SvelteComponentTyped<
      ${props_name},
      {${genEventDef({ events })}},
      {${genSlotDef({ slots })}}
    > {
      ${genAccessors({ props })}
    }`;
}

export interface WriteTsDefinitionsOptions {
  outDir: string;
  inputDir: string;
  preamble: string;
  exports: ParsedExports;
}

export default async function writeTsDefinitions(components: ComponentDocs, options: WriteTsDefinitionsOptions) {
  const ts_base_path = path.join(process.cwd(), options.outDir, "index.d.ts");
  const writer = new Writer({ parser: "typescript", printWidth: 80 });
  const indexDTs = options.preamble + createExports(options.exports, components);

  for await (const [moduleName, component] of components) {
    const ts_filepath = convertSvelteExt(path.join(options.outDir, component.filePath));
    await writer.write(ts_filepath, writeTsDefinition(component));
  }

  await writer.write(ts_base_path, indexDTs);

  console.log(`created TypeScript definitions.`);
}
