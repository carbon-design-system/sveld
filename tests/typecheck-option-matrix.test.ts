import { OPTION_MATRIX, runOptionMatrix } from "../scripts/typecheck-option-matrix";
import type { ComponentDocApi } from "../src/plugin";
import { type WriteTsDefinitionOptions, writeTsDefinition } from "../src/writer/writer-ts-definitions-core";

/**
 * Smoke tests for the option-matrix harness. CI runs the full matrix over
 * every fixture with `bun run test:types-matrix`; these only cover a few
 * fixtures so the harness itself can't silently stop detecting errors.
 */
const SAMPLE_FIXTURES = ["typedef-description", "rest-props-multiple", "module-script-types", "context-module"];

test("the matrix sets a non-default value for every emit option", () => {
  const set = (key: keyof WriteTsDefinitionOptions) =>
    OPTION_MATRIX.filter(({ options }) => options[key] !== undefined).map(({ options }) => options[key]);

  expect(set("format")).toContain("class");
  expect(set("format")).toContain("component");
  expect(set("exportTypes")).toContain(false);
  expect(set("exportTypes").some((value) => typeof value === "object")).toBe(true);
  expect(set("typeNames").length).toBeGreaterThan(0);
  expect(set("comments")).toContain("none");
  expect(set("comments")).toContain("descriptions");
  expect(set("propsDeclaration")).toContain("interface");
});

test("sample fixtures typecheck under every option set", async () => {
  const result = await runOptionMatrix({ fixtures: SAMPLE_FIXTURES });

  expect(result.sets.map((set) => set.name)).toEqual(OPTION_MATRIX.map((set) => set.name));
  expect(result.failures).toEqual([]);
}, 30_000); // Spawns one `tsc` per option set.

test("fails only the option sets whose output doesn't typecheck", async () => {
  // Break the output only under `propsDeclaration: "interface"`, the way a
  // writer bug confined to one code path would.
  const write = (component: ComponentDocApi, options: WriteTsDefinitionOptions) => {
    const output = writeTsDefinition(component, options);
    return options.propsDeclaration === "interface" ? `${output}\ndeclare const broken: MissingType;\n` : output;
  };
  const result = await runOptionMatrix({ fixtures: ["typedef-description"], write });

  const broken = OPTION_MATRIX.filter(({ options }) => options.propsDeclaration === "interface").map(
    ({ name }) => name,
  );
  expect(broken.length).toBeGreaterThan(0);
  expect(result.failures.map((failure) => failure.name)).toEqual(broken);
  for (const failure of result.failures) {
    expect(failure.output).toContain("typedef-description/");
    expect(failure.output).toContain("MissingType");
  }
}, 30_000);
