import { writeMarkdownCore } from "../../src/writer/writer-markdown-core";
import { writeTsDefinition } from "../../src/writer/writer-ts-definitions-core";
import data from "../src/data";
import { ComponentParser, finalizeWithoutCrossFileResolution } from "../src/parser";

// Every example, parsed at build time, so picking one needs no parser.
const parsed: Record<string, unknown> = {};
for (const { code, moduleName } of data) {
  const diagnostics = { moduleName, filePath: "VIRTUAL" };
  const component = finalizeWithoutCrossFileResolution(
    new ComponentParser().parseSvelteComponent(code, diagnostics),
    diagnostics,
  );
  const json = JSON.stringify(component);
  // Some parsed fields don't survive JSON, so keep only examples whose tabs
  // render the same from the copy as from the original. The rest parse in
  // the browser.
  const outputs = (c: typeof component) => [
    writeTsDefinition({ ...c, moduleName }),
    writeMarkdownCore(new Map([[moduleName, { ...c, moduleName }]])),
  ];
  if (outputs(component).join() === outputs(JSON.parse(json)).join()) parsed[moduleName] = JSON.parse(json);
  else if (moduleName === data[0]?.moduleName) {
    throw new Error(`${moduleName} renders differently once serialized; make another example the default`);
  }
}

process.stdout.write(JSON.stringify({ default: data[0]?.moduleName, parsed }));
