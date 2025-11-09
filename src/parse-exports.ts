import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { type Node, parse } from "acorn";
import { normalizeSeparators } from "./path";

interface NodeImportDeclaration extends Node {
  type: "ImportDeclaration";
  specifiers: { local: { name: string } }[];
  source: null | { value: string };
}

interface NodeExportNamedDeclaration extends Node, Pick<NodeImportDeclaration, "source"> {
  type: "ExportNamedDeclaration";
  specifiers: { local: { name: string }; exported: { name: string } }[];
}

interface NodeExportDefaultDeclaration extends Node {
  type: "ExportDefaultDeclaration";
  declaration: { name: string };
}

interface NodeExportAllDeclaration extends Node, Pick<NodeImportDeclaration, "source"> {
  type: "ExportAllDeclaration";
}

type BodyNode =
  | NodeImportDeclaration
  | NodeExportNamedDeclaration
  | NodeExportDefaultDeclaration
  | NodeExportAllDeclaration;

export type ParsedExports = Record<string, { source: string; default: boolean; mixed?: boolean }>;

interface ProgramNode extends Node {
  type: "Program";
  body: BodyNode[];
}

const astCache = new Map<string, ProgramNode>();

export function parseExports(source: string, dir: string) {
  let ast = astCache.get(source);

  if (!ast) {
    ast = parse(source, {
      ecmaVersion: "latest",
      sourceType: "module",
    }) as ProgramNode;
    astCache.set(source, ast);
  }

  const exports_by_identifier: ParsedExports = {};

  for (const node of ast.body) {
    if (node.type === "ExportDefaultDeclaration") {
      const id = node.declaration.name;

      if (id in exports_by_identifier) {
        exports_by_identifier[id].default = true;
      } else {
        exports_by_identifier[id] = { source: "", default: true };
      }
    } else if (node.type === "ExportAllDeclaration") {
      if (!node.source) continue;

      let file_path = resolve(dir, node.source.value);

      if (!lstatSync(file_path).isFile()) {
        const files = readdirSync(file_path);

        for (const file of files)
          if (file.includes("index")) {
            file_path = join(file_path, file);
            break;
          }
      }

      const export_file = readFileSync(file_path, "utf-8");
      const exports = parseExports(export_file, dirname(file_path));

      for (const [key, value] of Object.entries(exports)) {
        const source = normalizeSeparators(`./${join(node.source.value, value.source)}`);
        exports_by_identifier[key] = {
          ...value,
          source,
        };
      }
    } else if (node.type === "ExportNamedDeclaration") {
      for (const specifier of node.specifiers) {
        const exported_name = specifier.exported.name;
        const id = exported_name || specifier.local.name;

        if (id in exports_by_identifier) {
          if (node.type === "ExportNamedDeclaration") {
            exports_by_identifier[id].mixed = true;
          }

          if (!exports_by_identifier[id].source) {
            exports_by_identifier[id].source = node.source?.value ?? "";
          }
        } else {
          exports_by_identifier[id] = {
            source: node.source?.value ?? "",
            default: id === "default",
          };
        }
      }
    } else if (node.type === "ImportDeclaration") {
      const id = node.specifiers[0].local.name;

      if (id in exports_by_identifier) {
        if (!exports_by_identifier[id].source) {
          exports_by_identifier[id].source = node.source?.value ?? "";
        }
      } else {
        exports_by_identifier[id] = {
          source: node.source?.value ?? "",
          default: id === "default",
        };
      }
    }
  }

  return exports_by_identifier;
}
