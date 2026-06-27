import type { EntryExports } from "../src/parse-entry-exports";
import type { ComponentDocs } from "../src/plugin";
import { renderComponentsToMarkdown } from "../src/writer/markdown-render-utils";
import { BrowserWriterMarkdown } from "../src/writer/writer-markdown-core";

function render(components: ComponentDocs, entryExports?: EntryExports): string {
  const document = new BrowserWriterMarkdown({});
  renderComponentsToMarkdown(document, components, entryExports);
  return document.end();
}

describe("renderComponentsToMarkdown (entry exports)", () => {
  const entryExports: EntryExports = [
    {
      name: "VERSION",
      kind: "const",
      type: "string",
      value: '"1.0.0"',
      description: "Library version.",
      isTypeOnly: false,
    },
    { name: "clamp", kind: "function", type: "(value: number) => number", isTypeOnly: false },
    { name: "Theme", kind: "type", type: '"light" | "dark"', isTypeOnly: true },
  ];

  test("renders an Exports section with a row per export", () => {
    const output = render(new Map(), entryExports);

    expect(output).toContain("## Exports");
    expect(output).toContain("| Name | Kind | Type | Description |");
    expect(output).toContain("| VERSION | <code>const</code> | <code>string</code> | Library version. |");
    expect(output).toContain("| clamp | <code>function</code> | <code>(value: number) => number</code> | -- |");
    expect(output).toContain('| Theme | <code>type</code> | <code>"light" &#124; "dark"</code> | -- |');
  });

  test("flattens multi-line types onto a single table row", () => {
    const output = render(new Map(), [
      { name: "ThemeConfig", kind: "interface", type: "{\n  theme: Theme;\n  persist: boolean;\n}", isTypeOnly: true },
    ]);

    expect(output).toContain(
      "| ThemeConfig | <code>interface</code> | <code>{ theme: Theme; persist: boolean; }</code> | -- |",
    );
    // The type cell must not introduce a raw newline that would break the table.
    expect(output).not.toContain("theme: Theme;\n");
  });

  test("omits the Exports section when there are no entry exports", () => {
    expect(render(new Map(), [])).not.toContain("## Exports");
    expect(render(new Map())).not.toContain("## Exports");
  });
});
