// @reads tests/fixtures/rest-props-svelte-element-type-parameter/output-class.d.ts
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "@typescript/typescript6";

const ROOT = resolve(import.meta.dir, "..");
/** An excess property, with or without a "Did you mean" (TS2561). */
const EXCESS_PROPERTY = /^TS(2353|2561)$/;
/** The writer's output for a component whose tag follows a `Tag` type parameter. */
const POLYMORPHIC = readFileSync(
  join(ROOT, "tests/fixtures/rest-props-svelte-element-type-parameter/output-class.d.ts"),
  "utf8",
);

/** Type-checks `source` beside the component as `Box`, and as `Stack` with one more prop. */
function check(source: string) {
  // In the repo, so `svelte` resolves.
  const dir = mkdtempSync(join(ROOT, ".tmp-sveld-polymorphic-"));
  try {
    writeFileSync(join(dir, "Box.d.ts"), POLYMORPHIC);
    // A prop of its own, so the union's members differ, as two components' do.
    writeFileSync(join(dir, "Stack.d.ts"), POLYMORPHIC.replace("  tag?: Tag;", "  tag?: Tag;\n  gap?: number;"));
    writeFileSync(join(dir, "test.ts"), `import Box from "./Box";\nimport Stack from "./Stack";\n${source}`);
    const program = ts.createProgram([join(dir, "test.ts")], {
      strict: true,
      noEmit: true,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ESNext,
      lib: ["lib.esnext.d.ts", "lib.dom.d.ts"],
      types: [],
      skipLibCheck: true,
    });
    const errors = ts
      .getPreEmitDiagnostics(program)
      .map((d) => `TS${d.code}`)
      .sort();
    // Internal, as `--extendedDiagnostics` reads it: the types the check created.
    const types = (program.getTypeChecker() as unknown as { getTypeCount(): number }).getTypeCount();
    return { errors, types };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const options = (props: string) => `new Box({ target: null as any, props: ${props} });\n`;

test("infers the tag from `tag`, so its attributes follow it", () => {
  expect(check(options("{}")).errors).toEqual([]);
  expect(check(options('{ tag: "a", href: "/docs" }')).errors).toEqual([]);
  expect(check(`declare const tag: "div" | "section";\n${options('{ tag, id: "x" }')}`).errors).toEqual([]);
  expect(check(options('{ tag: "div", href: "/docs" }')).errors).toEqual([expect.stringMatching(EXCESS_PROPERTY)]);
});

test("builds each element type only as a use needs it", () => {
  // As a conditional on `Tag`, every tag's type was built: ~6.7K types for
  // one use, and ~250K, with over a gigabyte, for a union of two components.
  expect(check(options('{ tag: "a", href: "/docs" }')).types).toBeLessThan(3_000);
  const union = check(
    'declare const Component: typeof Box | typeof Stack;\nnew Component({ target: null as any, props: { "data-testid": "x" } });\n',
  );
  expect(union.errors).toEqual([]);
  expect(union.types).toBeLessThan(20_000);
}, 60_000);
