// A Bun macro: the build inlines the first example parsed, and the dev
// server gets null and parses live. JavaScript, so the client's typecheck
// doesn't follow it into sveld's Node-side source.
import { writeMarkdownCore } from "../../src/writer/writer-markdown-core";
import { writeTsDefinition } from "../../src/writer/writer-ts-definitions-core";
import data from "../src/data";
import { ComponentParser, finalizeWithoutCrossFileResolution } from "../src/parser";

export function defaultParsed() {
  if (process.env.NODE_ENV !== "production") return null;
  const { code, moduleName } = data[0];
  const diagnostics = { moduleName, filePath: "VIRTUAL" };
  const parsed = finalizeWithoutCrossFileResolution(
    new ComponentParser().parseSvelteComponent(code, diagnostics),
    diagnostics,
  );
  // Some parsed fields don't survive JSON; check the tabs render the same.
  const copy = JSON.parse(JSON.stringify(parsed));
  /** @param {typeof parsed} component */
  const outputs = (component) => [
    writeTsDefinition({ ...component, moduleName }),
    writeMarkdownCore(new Map([[moduleName, { ...component, moduleName }]])),
  ];
  if (outputs(parsed).join() !== outputs(copy).join()) {
    throw new Error(`${moduleName} renders differently once serialized; make another example the default`);
  }
  return copy;
}
