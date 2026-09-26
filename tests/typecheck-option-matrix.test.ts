import { OPTION_MATRIX, runOptionMatrix } from "../scripts/typecheck-option-matrix";
import type { ComponentDocApi } from "../src/plugin";
import { type WriteTsDefinitionOptions, writeTsDefinition } from "../src/writer/writer-ts-definitions-core";

/**
 * Tests for the option-matrix harness itself. CI runs the full matrix over
 * every fixture with `bun run test:types-matrix`; these check that the
 * harness covers every option and can't silently stop detecting errors.
 */

test("the matrix sets a non-default value for every emit option", () => {
  const set = (key: keyof WriteTsDefinitionOptions) =>
    OPTION_MATRIX.filter(({ options }) => options[key] !== undefined).map(({ options }) => options[key]);

  expect(set("format")).toContain("class");
  expect(set("format")).toContain("component");
});

test("fails only the option sets whose output doesn't typecheck", async () => {
  // Break the output only under `format: "component"`, the way a writer bug
  // confined to one code path would.
  const write = (component: ComponentDocApi, options: WriteTsDefinitionOptions) => {
    const output = writeTsDefinition(component, options);
    return options.format === "component" ? `${output}\ndeclare const broken: MissingType;\n` : output;
  };
  const result = await runOptionMatrix({ fixtures: ["typedef-description"], write });

  const broken = OPTION_MATRIX.filter(({ options }) => options.format === "component").map(({ name }) => name);
  expect(broken.length).toBeGreaterThan(0);
  expect(result.failures.map((failure) => failure.name)).toEqual(broken);
  for (const failure of result.failures) {
    expect(failure.output).toContain("typedef-description/");
    expect(failure.output).toContain("MissingType");
  }
}, 30_000);
