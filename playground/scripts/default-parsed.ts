import { writeMarkdownCore } from "../../src/writer/writer-markdown-core";
import { writeTsDefinition } from "../../src/writer/writer-ts-definitions-core";
import data from "../src/data";
import { ComponentParser, finalizeWithoutCrossFileResolution } from "../src/parser";

const { code, moduleName } = data[0];
const diagnostics = { moduleName, filePath: "VIRTUAL" };
const parsed = finalizeWithoutCrossFileResolution(
  new ComponentParser().parseSvelteComponent(code, diagnostics),
  diagnostics,
);
const json = JSON.stringify(parsed);

// Some parsed fields don't survive JSON, so check that the tabs render the
// same output from the copy as from the original.
const outputs = (component: typeof parsed) => [
  writeTsDefinition({ ...component, moduleName }),
  writeMarkdownCore(new Map([[moduleName, { ...component, moduleName }]])),
];
if (outputs(parsed).join() !== outputs(JSON.parse(json)).join()) {
  throw new Error(`${moduleName} renders differently once serialized; make another example the default`);
}

process.stdout.write(json);
