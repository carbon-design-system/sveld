import * as fs from "node:fs";
import path from "node:path";
import * as acorn from "acorn";
import { normalizeSeparators } from "./path";

interface NodeImportDeclaration extends acorn.Node {
  type: "ImportDeclaration";
  specifiers: { local: { name: string } }[];
  source: null | { value: string };
}

interface NodeExportNamedDeclaration extends acorn.Node, Pick<NodeImportDeclaration, "source"> {
  type: "ExportNamedDeclaration";
  specifiers: { local: { name: string }; exported: { name: string } }[];
}

interface NodeExportDefaultDeclaration extends acorn.Node {
  type: "ExportDefaultDeclaration";
  declaration: { name: string };
}

interface NodeExportAllDeclaration extends acorn.Node, Pick<NodeImportDeclaration, "source"> {
  type: "ExportAllDeclaration";
}

type BodyNode =
  | NodeImportDeclaration
  | NodeExportNamedDeclaration
  | NodeExportDefaultDeclaration
  | NodeExportAllDeclaration;

export type ParsedExports = Record<string, { source: string; default: boolean; mixed?: boolean }>;

export function parseExports(source: string, dir: string) {
  const ast = acorn.parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
  });

  const exports_by_identifier: ParsedExports = {};

  // @ts-expect-error
  ast.body.forEach((node: BodyNode) => {
    if (node.type === "ExportDefaultDeclaration") {
      const id = node.declaration.name;

      if (id in exports_by_identifier) {
        exports_by_identifier[id].default = true;
      } else {
        exports_by_identifier[id] = { source: "", default: true };
      }
    } else if (node.type === "ExportAllDeclaration") {
      if (!node.source) return;

      let file_path = path.resolve(dir, node.source.value);

      if (!fs.lstatSync(file_path).isFile()) {
        const files = fs.readdirSync(file_path);

        for (const file of files)
          if (file.includes("index")) {
            file_path = path.join(file_path, file);
            break;
          }
      }

      const export_file = fs.readFileSync(file_path, "utf-8");
      const exports = parseExports(export_file, path.dirname(file_path));

      for (const [key, value] of Object.entries(exports)) {
        const source = normalizeSeparators(`./${path.join(node.source.value, value.source)}`);
        exports_by_identifier[key] = {
          ...value,
          source,
        };
      }
    } else if (node.type === "ExportNamedDeclaration") {
      node.specifiers.forEach((specifier) => {
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
      });
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
  });

  return exports_by_identifier;
}
