import * as acorn from "acorn";

interface NodeImportDeclaration extends acorn.Node {
  type: "ImportDeclaration";
  specifiers: [{ local: { name: string } }];
  source: null | { value: string };
}

interface NodeExportNamedDeclaration extends acorn.Node, Pick<NodeImportDeclaration, "source"> {
  type: "ExportNamedDeclaration";
  specifiers: [{ local: { name: string }; exported: { name: string } }];
}

interface NodeExportDefaultDeclaration extends acorn.Node {
  type: "ExportDefaultDeclaration";
  declaration: { name: string };
}

type BodyNode = NodeImportDeclaration | NodeExportNamedDeclaration | NodeExportDefaultDeclaration;

export type ParsedExports = Record<string, { source: string; default: boolean; mixed?: boolean }>;

export function parseExports(source: string) {
  const ast = acorn.parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
  });

  const exports_by_identifier: ParsedExports = {};

  // @ts-ignore
  ast.body.forEach((node: BodyNode) => {
    if (node.type === "ExportDefaultDeclaration") {
      const id = node.declaration.name;

      if (id in exports_by_identifier) {
        exports_by_identifier[id].default = true;
      } else {
        exports_by_identifier[id] = { source: "", default: true };
      }
    }

    if (node.type === "ImportDeclaration" || node.type === "ExportNamedDeclaration") {
      const exported_name = node.type === "ExportNamedDeclaration" ? node.specifiers[0].exported?.name : undefined;
      const id = exported_name || node.specifiers[0].local.name;

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
  });

  return exports_by_identifier;
}
