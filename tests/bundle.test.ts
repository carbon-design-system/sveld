import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateBundle } from "../src/bundle";
import { TypeResolver } from "../src/resolve-types";

/** Imports an opaque whole-object props type; a resolveTypes candidate. */
const PROPS_IMPORTED_COMPONENT = `<script lang="ts">
  import type { Props } from "./types";

  let props: Props = $props();
</script>

<a href={props.href}>{props.variant}</a>
`;

const PROPS_TYPES = `export interface Props {
  href: string;
  variant: "a" | "b";
}
`;

/** A plain-TS \`@example\` block; a checkExamples candidate. */
const EXAMPLE_CHECK_COMPONENT = `<script>
  /**
   * @param {string} value
   * @returns {string}
   * @example
   * \`\`\`js
   * formatValue("ok");
   * \`\`\`
   */
  export function formatValue(value) {
    return value;
  }
</script>
`;

/** Neither an imported whole-props type nor an \`@example\` block: no candidates. */
const PLAIN_COMPONENT = `<script>
  /** @type {string} */
  export let label = "ok";
</script>
<button>{label}</button>
`;

const BARREL = `export { default as PropsImported } from "./PropsImported.svelte";
`;

function makeFakeResolver() {
  return {
    expandAll: jest.fn(async () => new Map()),
    checkExamples: jest.fn(async () => new Map()),
    dispose: jest.fn(async () => {}),
  };
}

describe("generateBundle shares one TypeResolver across resolveTypes and checkExamples", () => {
  let dir: string;
  let createSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-bundle-"));
  });

  afterEach(() => {
    createSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  test("creates and disposes exactly one resolver when both options have candidates", async () => {
    writeFileSync(path.join(dir, "index.ts"), BARREL);
    writeFileSync(path.join(dir, "PropsImported.svelte"), PROPS_IMPORTED_COMPONENT);
    writeFileSync(path.join(dir, "types.ts"), PROPS_TYPES);
    writeFileSync(path.join(dir, "ExampleCheck.svelte"), EXAMPLE_CHECK_COMPONENT);

    const fakeResolver = makeFakeResolver();
    createSpy = jest.spyOn(TypeResolver, "create").mockResolvedValue(fakeResolver as unknown as TypeResolver);

    await generateBundle(path.join(dir, "index.ts"), true, { resolveTypes: true, checkExamples: true });

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(fakeResolver.expandAll).toHaveBeenCalledTimes(1);
    expect(fakeResolver.checkExamples).toHaveBeenCalledTimes(1);
    expect(fakeResolver.dispose).toHaveBeenCalledTimes(1);
  });

  test("never creates a resolver when neither feature has candidates", async () => {
    writeFileSync(path.join(dir, "index.ts"), `export { default as Plain } from "./Plain.svelte";\n`);
    writeFileSync(path.join(dir, "Plain.svelte"), PLAIN_COMPONENT);

    const fakeResolver = makeFakeResolver();
    createSpy = jest.spyOn(TypeResolver, "create").mockResolvedValue(fakeResolver as unknown as TypeResolver);

    await generateBundle(path.join(dir, "index.ts"), true, { resolveTypes: true, checkExamples: true });

    expect(createSpy).not.toHaveBeenCalled();
  });

  test("a null resolver (no tsconfig) leaves both features as graceful no-ops", async () => {
    writeFileSync(path.join(dir, "index.ts"), BARREL);
    writeFileSync(path.join(dir, "PropsImported.svelte"), PROPS_IMPORTED_COMPONENT);
    writeFileSync(path.join(dir, "types.ts"), PROPS_TYPES);
    writeFileSync(path.join(dir, "ExampleCheck.svelte"), EXAMPLE_CHECK_COMPONENT);

    createSpy = jest.spyOn(TypeResolver, "create").mockResolvedValue(null);

    const result = await generateBundle(path.join(dir, "index.ts"), true, {
      resolveTypes: true,
      checkExamples: true,
    });

    expect(createSpy).toHaveBeenCalledTimes(1);

    const propsImported = result.components.get("PropsImported");
    expect(propsImported?.props).toEqual([]);

    const exampleCheck = result.allComponentsForTypes.get("ExampleCheck");
    expect(exampleCheck?.diagnostics ?? []).toEqual([]);
  });
});
