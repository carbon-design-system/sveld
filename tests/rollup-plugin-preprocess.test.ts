import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateBundle } from "../src/plugin";
import { writeTsDefinition } from "../src/writer/writer-ts-definitions";

describe("metadata source preservation", () => {
  test("preserves TypeScript annotations while stripping only the top-level style block", async () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), "sveld-plugin-"));

    try {
      const componentDir = path.join(fixtureDir, "src");
      mkdirSync(componentDir, { recursive: true });

      writeFileSync(
        path.join(componentDir, "Button.svelte"),
        `<script lang="ts">
  const css = \`<style>body { color: white; }</style>\`;

  interface Props {
    message: string;
  }

  let { message }: Props = $props();
</script>

<div>{css}{message}</div>

<style>
  div { color: red; }
</style>
`,
      );

      const result = await generateBundle(componentDir, true);
      const component = result.allComponentsForTypes.get("Button");

      expect(component).toBeDefined();
      expect(component?.props.find((prop) => prop.name === "message")?.type).toBe("string");

      if (component === undefined) {
        throw new Error("Expected Button component");
      }
      const declaration = writeTsDefinition(component);
      expect(declaration).toContain("interface Props");
      expect(declaration).toContain("export type ButtonProps = $Props;");
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});
