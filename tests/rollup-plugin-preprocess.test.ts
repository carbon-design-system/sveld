import { preprocess } from "svelte/compiler";
import { replace, typescript } from "svelte-preprocess";

describe("rollup-plugin preprocessing", () => {
  test("should handle HTML tags in template literals (issue #115)", async () => {
    const source = `<script>
  const css = \`<style>body { color: white; }</style>\`;
  export let message = "test";
</script>

<div>{message}</div>

<style>
  div { color: red; }
</style>
`;

    // This is the exact preprocessing logic from rollup-plugin.ts line 90
    const { code: processed } = await preprocess(source, [typescript(), replace([[/<style.+?<\/style>/gims, ""]])], {
      filename: "test.svelte",
    });

    // The processed code should:
    // 1. Still have a complete <script> block
    // 2. Still have the const css declaration
    // 3. Should have removed the <style> block (that's expected)
    expect(processed).toContain("<script>");
    expect(processed).toContain("</script>");
    expect(processed).toContain("const css");
    expect(processed).toContain("export let message");
  });
});
