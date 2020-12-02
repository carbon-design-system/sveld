import * as path from "path";
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
  const props = def.props
    .map((prop) => {
      const prop_comments = [
        addCommentLine(prop.description?.replace(/\n/g, "\n* ")),
        addCommentLine(prop.constant, "@constant"),
        addCommentLine(
          prop.value,
          `@default ${typeof prop.value === "string" ? prop.value.replace(/\s+/g, " ") : prop.value}`
        ),
      ]
        .filter(Boolean)
        .join("");

      let prop_value = prop.constant && !prop.isFunction ? prop.value : prop.type;

      return `
      ${prop_comments.length > 0 ? `/**\n${prop_comments}*/` : EMPTY_STR}
      ${prop.name}?: ${prop_value};`;
    })
    .join("\n");

  const props_name = `${def.moduleName}Props`;

  let prop_def = EMPTY_STR;

  if (def.rest_props?.type === "Element") {
    const extend_tag_map = def.rest_props.name
      .split("|")
      .map((name) => `svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["${name.trim()}"]>`)
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
  return def.events
    .map((event) => {
      return `${clampKey(event.name)}: ${
        event.type === "dispatched" ? `CustomEvent<${event.detail || ANY_TYPE}>` : `WindowEventMap["${event.name}"]`
      };`;
    })
    .join("\n");
}

function genImports(def: Pick<ComponentDocApi, "extends">) {
  if (def.extends === undefined) return "";
  return `import { ${def.extends.interface} } from ${def.extends.import};`;
}

export function writeTsDefinition(component: ComponentDocApi) {
  const { moduleName, typedefs, props, slots, events, rest_props, extends: _extends } = component;
  const { props_name, prop_def } = genPropDef({
    moduleName,
    props,
    rest_props,
    extends: _extends,
  });

  return `
  /// <reference types="svelte" />
  import { SvelteComponentTyped } from "svelte";
  ${genImports({ extends: _extends })}
  ${getTypeDefs({ typedefs })}
  ${prop_def}

  export default class ${moduleName} extends SvelteComponentTyped<
      ${props_name},
      {${genEventDef({ events })}},
      {${genSlotDef({ slots })}}
    > {}`;
}

function createExport(file_path: string, { moduleName, isDefault }: { moduleName: string; isDefault: boolean }) {
  return `export { default as ${isDefault ? "default" : moduleName} } from "${file_path}";`;
}

export interface WriteTsDefinitionsOptions {
  outDir: string;
  inputDir: string;
  preamble: string;
  exports: string[];
  default_export: { moduleName: null | string; only: boolean };
  rendered_exports: string[];
}

export default async function writeTsDefinitions(components: ComponentDocs, options: WriteTsDefinitionsOptions) {
  const ts_folder_path = path.join(process.cwd(), options.outDir);
  const ts_base_path = path.join(ts_folder_path, "index.d.ts");
  const writer = new Writer({ parser: "typescript", printWidth: 120 });

  let indexDTs = options.preamble;

  for await (const [moduleName, component] of components) {
    const ts_filepath = component.filePath.replace(".svelte", ".d.ts");
    const ts_path = component.filePath.replace(".svelte", "");
    const export_path = ts_path.startsWith("./") ? ts_path : "./" + ts_path;

    if (options.default_export.moduleName == null) {
      indexDTs += createExport(export_path, { moduleName, isDefault: false });
    } else {
      if (options.default_export.only) {
        indexDTs += createExport(export_path, { moduleName, isDefault: true });
      } else {
        indexDTs += createExport(export_path, { moduleName, isDefault: false });

        if (options.rendered_exports.includes(moduleName)) {
          indexDTs += createExport(export_path, { moduleName, isDefault: true });
        }
      }
    }

    await writer.write(path.join(ts_folder_path, ts_filepath), writeTsDefinition(component));
  }

  await writer.write(ts_base_path, indexDTs);

  process.stdout.write(`created TypeScript definitions.\n`);
}
