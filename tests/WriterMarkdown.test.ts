import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { asNormalizedPath } from "../src/brands";
import ComponentParser from "../src/ComponentParser";
import type { ComponentDocs } from "../src/plugin";
import { formatDescriptionWithTags, formatPropDescription } from "../src/writer/markdown-format-utils";
import type { AppendType } from "../src/writer/WriterMarkdown";
import WriterMarkdown from "../src/writer/WriterMarkdown";
import writeMarkdown from "../src/writer/writer-markdown";
import { writeMarkdownCore } from "../src/writer/writer-markdown-core";
import { mockComponentDocApi } from "./test-brands";

describe("WriterMarkdown", () => {
  test("inserts table-of-contents headings verbatim, even ones that look like replacement patterns", () => {
    const document = new WriterMarkdown({});
    document.append("h1", "Index");
    document.append("h2", "Components").tableOfContents();
    document.append("h2", "Price $& Co");
    document.append("h2", "Say $' and $` and $1");

    const output = document.end();
    expect(output).toContain("- [Price $& Co](#price-co)");
    expect(output).toContain("- [Say $' and $` and $1](#say-and-and-1)");
    expect(output).not.toContain("__TOC__");
  });

  test("does not scan for a table of contents when none was requested", () => {
    const document = new WriterMarkdown({});
    document.append("h1", "Index");
    document.append("h2", "Components");
    expect(document.end()).toBe("# Index\n\n## Components\n\n");
  });

  test("basic functionality", () => {
    const types: AppendType[] = [];
    const document = new WriterMarkdown({
      onAppend: (type) => types.push(type),
    });

    document.append("h1", "Component Index");
    document.append("h2", "Components").tableOfContents();
    document.append("divider");

    expect(document.end()).toEqual("# Component Index\n\n## Components\n\n\n\n---\n\n");

    document.append("raw", "> Quote");
    document.append("p", "Text");

    expect(document.end()).toEqual("# Component Index\n\n## Components\n\n\n\n---\n\n> QuoteText\n\n");
    expect(types).toEqual(["h1", "h2", "divider", "raw", "p"]);
  });

  test("heading levels and table of contents", () => {
    const document = new WriterMarkdown({});

    document.append("h1", "Main Title");
    document.append("h2", "Section 1");
    document.append("h3", "Subsection 1.1");

    const output = document.end();
    expect(output).toContain("# Main Title");
    expect(output).toContain("## Section 1");
    expect(output).toContain("### Subsection 1.1");
  });

  test("quote formatting", () => {
    const document = new WriterMarkdown({});

    document.append("quote", "This is a quote");
    document.append("p", "This is a paragraph");
    document.append("quote", "Multi\nline\nquote");

    const output = document.end();
    expect(output).toEqual("> This is a quote\n\nThis is a paragraph\n\n> Multi\nline\nquote\n\n");
  });

  test("raw content and dividers", () => {
    const document = new WriterMarkdown({});

    document.append("raw", "No line break");
    document.append("raw", " after this.");
    document.append("divider");
    document.append("p", "New paragraph");

    expect(document.end()).toEqual("No line break after this.---\n\nNew paragraph\n\n");
  });

  test("onAppend callback receives correct arguments", () => {
    let lastType: AppendType | undefined;
    let lastDocument: WriterMarkdown | undefined;

    const document = new WriterMarkdown({
      onAppend: (type, doc) => {
        lastType = type;
        lastDocument = doc;
      },
    });

    document.append("h1", "Title");

    expect(lastType).toBe("h1");
    expect(lastDocument).toBe(document);
  });

  test("props table includes binding metadata", () => {
    const output = writeMarkdownCore(
      new Map([
        [
          "Example",
          {
            filePath: asNormalizedPath("Example.svelte"),
            moduleName: "Example",
            syntaxMode: "legacy",
            props: [
              {
                name: "size",
                kind: "let",
                constant: false,
                description: "Current value.",
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
                binding: "readonly",
              },
              {
                name: "open",
                kind: "let",
                constant: false,
                description: "Shared state.",
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: true,
                binding: "writable",
              },
              {
                name: "label",
                kind: "let",
                constant: false,
                description: "Label text.",
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
              },
            ],
            moduleExports: [],
            slots: [],
            events: [],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    expect(output).toMatchSnapshot();
    expect(output).toContain(
      "| Prop name | Required | Kind | Reactive | Binding | Type | Default value | Description |",
    );
    expect(output).toContain("| open | No | <code>let</code> | Yes | writable | -- | -- | Shared state. |");
    expect(output).toContain("| size | No | <code>let</code> | No | readonly | -- | -- | Current value. |");
    expect(output).toContain("| label | No | <code>let</code> | No | -- | -- | -- | Label text. |");
  });

  test("module exports table shows a re-export's source", () => {
    const reExport = {
      kind: "re-export" as const,
      constant: false,
      isFunction: false,
      isFunctionDeclaration: false,
      isRequired: false,
      reactive: false,
    };
    const output = writeMarkdownCore(
      new Map([
        [
          "Tree",
          {
            filePath: asNormalizedPath("Tree.svelte"),
            moduleName: "Tree",
            syntaxMode: "legacy",
            props: [],
            moduleExports: [
              { ...reExport, name: "toHierarchy", reExport: { from: "./to-hierarchy.js", imported: "toHierarchy" } },
              { ...reExport, name: "Initials", reExport: { from: "./initials.js", imported: "default" } },
              { ...reExport, name: "*", reExport: { from: "./other.js", imported: "*" } },
            ],
            slots: [],
            events: [],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    expect(output).toContain(
      '| toHierarchy | <code>re-export</code> | <code>typeof import("./to-hierarchy.js").toHierarchy</code> | -- |',
    );
    expect(output).toContain(
      '| Initials | <code>re-export</code> | <code>typeof import("./initials.js").default</code> | -- |',
    );
    expect(output).toContain('| * | <code>re-export</code> | <code>typeof import("./other.js")</code> | -- |');
  });

  test("slots table renders descriptions and pass-through tags", () => {
    const output = writeMarkdownCore(
      new Map([
        [
          "Example",
          {
            filePath: asNormalizedPath("Example.svelte"),
            moduleName: "Example",
            syntaxMode: "legacy",
            props: [],
            moduleExports: [],
            slots: [
              {
                name: null,
                default: true,
                slot_props: "{ prop: number }",
                description: "Default content.\nSpans two lines.",
                tags: [
                  { name: "deprecated", body: "Prefer the `body` slot." },
                  { name: "since", body: "1.2.0" },
                ],
              },
              {
                name: "title",
                default: false,
                slot_props: "{}",
                description: "Heading content.",
                tags: [{ name: "example", body: "<Example>Hi</Example>" }],
              },
              {
                name: "footer",
                default: false,
                slot_props: "{}",
              },
            ],
            events: [],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    expect(output).toMatchSnapshot();
    expect(output).toContain("| Slot name | Default | Props | Fallback | Description |");
    expect(output).toContain(
      "| -- | Yes | <code>{ prop: number } </code> | -- | Default content.<br />Spans two lines.<br />@deprecated Prefer the `body` slot.<br />@since 1.2.0 |",
    );
    expect(output).toContain(
      "| title | No | -- | -- | Heading content.<br />@example &lt;Example&gt;Hi&lt;/Example&gt; |",
    );
    expect(output).toContain("| footer | No | -- | -- | -- |");
  });

  test("props and events tables render pass-through tags like slots do", () => {
    const output = writeMarkdownCore(
      new Map([
        [
          "Example",
          {
            filePath: asNormalizedPath("Example.svelte"),
            moduleName: "Example",
            syntaxMode: "legacy",
            props: [
              {
                name: "size",
                kind: "let",
                constant: false,
                description: "Current value.",
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
                tags: [{ name: "since", body: "1.2.0" }],
              },
            ],
            moduleExports: [],
            slots: [],
            events: [
              {
                type: "dispatched",
                name: "change",
                description: "Fires on change.",
                tags: [{ name: "example", body: "on:change={handleChange}" }],
              },
            ],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    expect(output).toContain("| size | No | <code>let</code> | No | -- | -- | -- | Current value.<br />@since 1.2.0 |");
    expect(output).toContain("| change | dispatched | -- | Fires on change.<br />@example on:change={handleChange} |");
  });

  test("rewrites {@link} to a Markdown link in prop and slot descriptions", () => {
    const output = writeMarkdownCore(
      new Map([
        [
          "Example",
          {
            filePath: asNormalizedPath("Example.svelte"),
            moduleName: "Example",
            syntaxMode: "legacy",
            props: [
              {
                name: "width",
                kind: "let",
                constant: false,
                description: "The width in pixels. See {@link https://example.com/width|width docs}.",
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
              },
              {
                name: "height",
                kind: "let",
                constant: false,
                description: "See {@link https://example.com/height}.",
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
              },
            ],
            moduleExports: [],
            slots: [],
            events: [],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    expect(output).toContain("See [width docs](https://example.com/width).");
    expect(output).toContain("See [https://example.com/height](https://example.com/height).");
  });

  test("defines the component's type parameters for generic components", () => {
    const output = writeMarkdownCore(
      new Map([
        [
          "DataTable",
          {
            filePath: asNormalizedPath("DataTable.svelte"),
            moduleName: "DataTable",
            syntaxMode: "runes",
            props: [
              {
                name: "rows",
                kind: "let",
                constant: false,
                type: "ReadonlyArray<Row>",
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: true,
                reactive: false,
              },
            ],
            moduleExports: [],
            slots: [],
            events: [],
            typedefs: [],
            generics: ["Row", "Row extends DataTableRow = DataTableRow"],
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    expect(output).toMatchSnapshot();
    // `Row` is used in the prop type below; without this line it would be an
    // undefined name floating in the document.
    expect(output).toContain("**Type parameters:** <code>&lt;Row extends DataTableRow = DataTableRow></code>");
    expect(output).toContain(
      "| rows | Yes | <code>let</code> | No | -- | <code>ReadonlyArray&lt;Row></code> | -- | -- |",
    );
  });

  test("omits the type parameters line for non-generic components", () => {
    const output = writeMarkdownCore(
      new Map([
        [
          "Example",
          {
            filePath: asNormalizedPath("Example.svelte"),
            moduleName: "Example",
            syntaxMode: "legacy",
            props: [],
            moduleExports: [],
            slots: [],
            events: [],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    expect(output).not.toContain("Type parameters");
  });

  test("badges deprecated props, events, and slots", () => {
    const output = writeMarkdownCore(
      new Map([
        [
          "Example",
          {
            filePath: asNormalizedPath("Example.svelte"),
            moduleName: "Example",
            syntaxMode: "legacy",
            props: [
              {
                name: "label",
                kind: "let",
                constant: false,
                description: "Label text.",
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
                deprecated: "Use `text` instead.",
              },
              {
                name: "id",
                kind: "let",
                constant: false,
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
                deprecated: true,
              },
            ],
            moduleExports: [],
            slots: [
              {
                name: "badge",
                default: false,
                deprecated: "Render the badge inline instead.",
              },
            ],
            events: [
              {
                type: "dispatched",
                name: "change",
                description: "Fires on change.",
                deprecated: "Listen for `input` instead.",
              },
            ],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    // Deprecated entries are struck through and badged with the message.
    expect(output).toContain(
      "| <s>label</s><br />**Deprecated**: Use `text` instead. | No | <code>let</code> | No | -- | -- | -- | Label text. |",
    );
    // A bare `@deprecated` (no message) still badges, without a trailing message.
    expect(output).toContain("| <s>id</s><br />**Deprecated** | No | <code>let</code> | No | -- | -- | -- | -- |");
    expect(output).toContain("| <s>badge</s><br />**Deprecated**: Render the badge inline instead. | No |");
    expect(output).toContain(
      "| <s>change</s><br />**Deprecated**: Listen for `input` instead. | dispatched | -- | Fires on change. |",
    );
  });

  test("escapes pipes in prop descriptions so they don't break the table", () => {
    const output = writeMarkdownCore(
      new Map([
        [
          "Example",
          {
            filePath: asNormalizedPath("Example.svelte"),
            moduleName: "Example",
            syntaxMode: "legacy",
            props: [
              {
                name: "mode",
                kind: "let",
                constant: false,
                description: 'Use "a | b" syntax.',
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
              },
            ],
            moduleExports: [],
            slots: [],
            events: [],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    expect(output).toContain('Use "a &#124; b" syntax.');
  });

  test("TOC anchors match GitHub's heading slugger, including duplicate suffixes", () => {
    const document = new WriterMarkdown({});
    document.tableOfContents();
    document.append("h2", "Button (legacy) v2");
    document.append("h2", "Button (legacy) v2");
    document.append("h2", "Button (legacy) v2");

    const output = document.end();
    expect(output).toContain("- [Button (legacy) v2](#button-legacy-v2)\n");
    expect(output).toContain("- [Button (legacy) v2](#button-legacy-v2-1)");
    expect(output).toContain("- [Button (legacy) v2](#button-legacy-v2-2)");
  });

  test("prop table keeps reactive props first, constants last, declaration order otherwise", () => {
    const output = writeMarkdownCore(
      new Map([
        [
          "Example",
          {
            filePath: asNormalizedPath("Example.svelte"),
            moduleName: "Example",
            syntaxMode: "legacy",
            props: [
              {
                name: "constantOne",
                kind: "let",
                constant: true,
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
              },
              {
                name: "regularOne",
                kind: "let",
                constant: false,
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
              },
              {
                name: "reactiveOne",
                kind: "let",
                constant: false,
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: true,
              },
              {
                name: "regularTwo",
                kind: "let",
                constant: false,
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
              },
              {
                name: "reactiveTwo",
                kind: "let",
                constant: false,
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: true,
              },
              {
                name: "constantTwo",
                kind: "let",
                constant: true,
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
              },
            ],
            moduleExports: [],
            slots: [],
            events: [],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    const names = ["reactiveOne", "reactiveTwo", "regularOne", "regularTwo", "constantOne", "constantTwo"];
    const positions = names.map((name) => output.indexOf(`| ${name} |`));
    expect(positions.every((position) => position !== -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  test("default value column shows the text of logical and conditional initializers", () => {
    const source = `
      <script>
        let defaultSize = "md";
        let compact = false;
        export let size = defaultSize ?? "md";
        export let label = compact
          ? "short"
          : "More";
      </script>
    `;
    const parsed = new ComponentParser().parseSvelteComponent(source, {
      moduleName: "Example",
      filePath: "Example.svelte",
    });
    const output = writeMarkdownCore(
      new Map([["Example", { filePath: asNormalizedPath("Example.svelte"), moduleName: "Example", ...parsed }]]),
    );

    expect(output).toContain(
      '| size | No | <code>let</code> | No | -- | <code>string</code> | <code>defaultSize ?? "md"</code> |',
    );
    expect(output).toContain(
      '| label | No | <code>let</code> | No | -- | <code>string</code> | <code>compact ? "short" : "More"</code> |',
    );
  });

  test("renders CSS Parts and CSS Custom Properties tables only when present", () => {
    const withCss = writeMarkdownCore(
      new Map([
        [
          "Card",
          {
            filePath: asNormalizedPath("Card.svelte"),
            moduleName: "Card",
            syntaxMode: "legacy",
            props: [],
            moduleExports: [],
            slots: [],
            events: [],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
            cssParts: [{ name: "header", description: "Styles the header region." }],
            cssProperties: [
              { name: "--card-background", type: "Color", default: "white", description: "Card background." },
              { name: "--card-border-color", description: "Card border color." },
            ],
          },
        ],
      ]),
    );

    expect(withCss).toContain("### CSS Parts");
    expect(withCss).toContain("| Part name | Description |");
    expect(withCss).toContain("| header | Styles the header region. |");
    expect(withCss).toContain("### CSS Custom Properties");
    expect(withCss).toContain("| Property name | Type | Default value | Description |");
    expect(withCss).toContain("| --card-background | <code>Color</code> | <code>white</code> | Card background. |");
    expect(withCss).toContain("| --card-border-color | -- | -- | Card border color. |");

    const withoutCss = writeMarkdownCore(
      new Map([
        [
          "Plain",
          {
            filePath: asNormalizedPath("Plain.svelte"),
            moduleName: "Plain",
            syntaxMode: "legacy",
            props: [],
            moduleExports: [],
            slots: [],
            events: [],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    expect(withoutCss).not.toContain("CSS Parts");
    expect(withoutCss).not.toContain("CSS Custom Properties");
  });

  test('renders a Module exports table for `<script context="module">` exports', () => {
    const output = writeMarkdownCore(
      new Map([
        [
          "Example",
          {
            filePath: asNormalizedPath("Example.svelte"),
            moduleName: "Example",
            syntaxMode: "legacy",
            props: [],
            moduleExports: [
              {
                name: "VERSION",
                kind: "const",
                constant: true,
                type: "string",
                description: "Package version.",
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
              },
              {
                name: "reset",
                kind: "function",
                constant: false,
                isFunction: true,
                isFunctionDeclaration: true,
                isRequired: false,
                reactive: false,
                description: "Resets shared state.",
              },
            ],
            slots: [],
            events: [],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    expect(output).toContain("### Module exports");
    expect(output).toContain("| Name | Kind | Type | Description |");
    expect(output).toContain("| VERSION | <code>const</code> | <code>string</code> | Package version. |");
    expect(output).toContain("| reset | <code>function</code> | -- | Resets shared state. |");
  });

  test("renders a members table for a class module export, once per class", () => {
    const store = {
      name: "Store",
      kind: "class" as const,
      constant: false,
      type: "typeof Store",
      typeParameters: "T",
      description: "Holds a value.",
      members: [
        { kind: "constructor" as const, name: "constructor", params: [{ name: "initial", type: "T" }] },
        { kind: "property" as const, name: "value", type: "T", description: "Current value." },
        {
          kind: "method" as const,
          name: "create",
          static: true as const,
          typeParameters: "U",
          params: [{ name: "value", type: "U" }],
          returnType: "Store<U>",
          deprecated: "Use `new Store` instead." as const,
        },
      ],
      isFunction: false,
      isFunctionDeclaration: false,
      isRequired: false,
      reactive: false,
    };
    const output = writeMarkdownCore(
      new Map([
        [
          "Example",
          {
            filePath: asNormalizedPath("Example.svelte"),
            moduleName: "Example",
            syntaxMode: "legacy",
            props: [],
            moduleExports: [store, { ...store, name: "Alias", localName: "Store" }],
            slots: [],
            events: [],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    expect(output).toContain("| Store | <code>class</code> | <code>typeof Store</code> | Holds a value. |");
    expect(output).toContain("| Alias | <code>class</code> | <code>typeof Store</code> | Holds a value. |");
    expect(output.match(/#### `Store` members/g)).toHaveLength(1);
    expect(output).toContain("| Member | Signature | Description |");
    expect(output).toContain("| constructor | <code>constructor(initial: T)</code> | -- |");
    expect(output).toContain("| value | <code>value: T</code> | Current value. |");
    expect(output).toContain(
      "| <s>create</s><br />**Deprecated**: Use `new Store` instead. | <code>static create&lt;U>(value: U): Store&lt;U></code> | -- |",
    );
  });

  test("lists a class's extends and implements clauses above its members", () => {
    const store = {
      name: "Store",
      kind: "class" as const,
      constant: false,
      type: "typeof Store",
      extends: "Base<T>",
      implements: ["Disposable", "Named"],
      members: [{ kind: "method" as const, name: "dispose", params: [], returnType: "void" }],
      isFunction: false,
      isFunctionDeclaration: false,
      isRequired: false,
      reactive: false,
    };
    const empty = { ...store, name: "Empty", type: "typeof Empty", implements: undefined, members: [] };
    const output = writeMarkdownCore(
      new Map([
        [
          "Example",
          {
            filePath: asNormalizedPath("Example.svelte"),
            moduleName: "Example",
            syntaxMode: "legacy",
            props: [],
            moduleExports: [store, empty],
            slots: [],
            events: [],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    expect(output).toContain(
      "#### `Store` members\n\nExtends <code>Base&lt;T></code>. Implements <code>Disposable</code>, <code>Named</code>.",
    );
    // A class with no members of its own still shows what it extends.
    expect(output).toContain("#### `Empty` members\n\nExtends <code>Base&lt;T></code>.");
  });

  test("omits the Module exports table when there are no module exports", () => {
    const output = writeMarkdownCore(
      new Map([
        [
          "Example",
          {
            filePath: asNormalizedPath("Example.svelte"),
            moduleName: "Example",
            syntaxMode: "legacy",
            props: [],
            moduleExports: [],
            slots: [],
            events: [],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    expect(output).not.toContain("Module exports");
  });

  test("marks const and function-declaration props as accessor kind in the props table", () => {
    const output = writeMarkdownCore(
      new Map([
        [
          "Example",
          {
            filePath: asNormalizedPath("Example.svelte"),
            moduleName: "Example",
            syntaxMode: "runes",
            props: [
              {
                name: "count",
                kind: "const",
                constant: true,
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
              },
              {
                name: "focus",
                kind: "function",
                constant: false,
                isFunction: true,
                isFunctionDeclaration: true,
                isRequired: false,
                reactive: false,
              },
              {
                name: "label",
                kind: "let",
                constant: false,
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
              },
            ],
            moduleExports: [],
            slots: [],
            events: [],
            typedefs: [],
            generics: null,
            rest_props: undefined,
            contexts: [],
          },
        ],
      ]),
    );

    expect(output).toContain("| count | No | <code>accessor</code> |");
    expect(output).toContain("| focus | No | <code>accessor</code> |");
    expect(output).toContain("| label | No | <code>let</code> |");
  });

  describe("markdownOptions.outDir", () => {
    test("writes one file per component plus an index README.md with links", async () => {
      const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-md-outdir-"));
      const components: ComponentDocs = new Map([
        ["Alert", mockComponentDocApi("Alert", "Alert.svelte")],
        ["Button", mockComponentDocApi("Button", "Button.svelte")],
      ]);

      try {
        await writeMarkdown(components, { outFile: "unused.md", outDir: tempDir });

        expect(existsSync(path.join(tempDir, "README.md"))).toBe(true);
        expect(existsSync(path.join(tempDir, "Alert.md"))).toBe(true);
        expect(existsSync(path.join(tempDir, "Button.md"))).toBe(true);

        const index = readFileSync(path.join(tempDir, "README.md"), "utf-8");
        expect(index).toContain("# Component Index");
        expect(index).toContain("- [Alert](./Alert.md)");
        expect(index).toContain("- [Button](./Button.md)");
        // Per-component sections live in their own files, not the index.
        expect(index).not.toContain("### Props");

        const alert = readFileSync(path.join(tempDir, "Alert.md"), "utf-8");
        expect(alert).toContain("## `Alert`");
        expect(alert).toContain("### Props");
        expect(alert).not.toContain("`Button`");
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test("index README.md includes the Exports section when documentExports is on", async () => {
      const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-md-outdir-exports-"));
      const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);

      try {
        await writeMarkdown(components, {
          outFile: "unused.md",
          outDir: tempDir,
          entryExports: [{ name: "VERSION", kind: "const", type: "string", isTypeOnly: false, value: '"1.0.0"' }],
        });

        const index = readFileSync(path.join(tempDir, "README.md"), "utf-8");
        expect(index).toContain("## Exports");
        expect(index).toContain("VERSION");
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test("outFile is ignored and no combined file is written when outDir is set", async () => {
      const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-md-outdir-ignores-outfile-"));
      const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);

      try {
        await writeMarkdown(components, { outFile: path.join(tempDir, "COMPONENT_INDEX.md"), outDir: tempDir });

        expect(existsSync(path.join(tempDir, "COMPONENT_INDEX.md"))).toBe(false);
        expect(existsSync(path.join(tempDir, "README.md"))).toBe(true);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});

describe("code fences in table cells", () => {
  test("prose-only text is unchanged", () => {
    expect(
      formatDescriptionWithTags("Uses `kind` | size.\n\nSecond <b>paragraph</b>.", [{ name: "since", body: "1.2.0" }]),
    ).toBe("Uses `kind` &#124; size.<br /><br />Second &lt;b&gt;paragraph&lt;/b&gt;.<br />@since 1.2.0");
    expect(formatPropDescription("Inline `code` and a\nline break.")).toBe("Inline `code` and a<br />line break.");
  });

  test("renders a fenced block in a description as <pre><code>", () => {
    expect(formatPropDescription("Renders an icon:\n```svelte\n<Icon />\n```\nThen more text.")).toBe(
      "Renders an icon:<pre><code>&lt;Icon /></code></pre>Then more text.",
    );
  });

  test("keeps the indentation of an @example fence, one <br /> per line", () => {
    const body = '```svelte\n<Button>\n  <Icon slot="icon" size={20} />\n</Button>\n```';
    expect(formatDescriptionWithTags("Specify the icon.", [{ name: "example", body }])).toBe(
      'Specify the icon.<br />@example <pre><code>&lt;Button><br />  &lt;Icon slot="icon" size={20} /><br />&lt;/Button></code></pre>',
    );
  });

  test("adds no <br /> between a closing fence and the next tag", () => {
    expect(formatDescriptionWithTags("Usage:\n```js\nrun();\n```", [{ name: "since", body: "2.0.0" }])).toBe(
      "Usage:<pre><code>run();</code></pre>@since 2.0.0",
    );
  });

  test("strips the opening fence's indentation from an indented fence", () => {
    expect(formatPropDescription("Call it:\n  ```ts\n  start();\n    step();\n  ```")).toBe(
      "Call it:<pre><code>start();<br />  step();</code></pre>",
    );
  });

  test("escapes Markdown syntax inside a fence and leaves {@link} alone", () => {
    expect(formatPropDescription("```ts\nconst a = b || c; // `x` *y* _z_ {@link Foo}\n```")).toBe(
      "<pre><code>const a = b &#124;&#124; c; // &#96;x&#96; &#42;y&#42; &#95;z&#95; {@link Foo}</code></pre>",
    );
  });

  test("supports tilde fences, longer fences and an unclosed fence", () => {
    expect(formatPropDescription("~~~\na\n~~~")).toBe("<pre><code>a</code></pre>");
    expect(formatPropDescription("````md\n```\ninner\n```\n````")).toBe(
      "<pre><code>&#96;&#96;&#96;<br />inner<br />&#96;&#96;&#96;</code></pre>",
    );
    expect(formatPropDescription("Open:\n```js\nleft();")).toBe("Open:<pre><code>left();</code></pre>");
  });

  test("renders an @example fence in the props table", () => {
    const output = writeMarkdownCore(
      new Map([
        [
          "Example",
          mockComponentDocApi("Example", "Example.svelte", {
            syntaxMode: "legacy",
            props: [
              {
                name: "icon",
                kind: "let",
                constant: false,
                description: "The icon.",
                isFunction: false,
                isFunctionDeclaration: false,
                isRequired: false,
                reactive: false,
                tags: [{ name: "example", body: "```svelte\n<Button>\n  <Icon />\n</Button>\n```" }],
              },
            ],
          }),
        ],
      ]),
    );

    expect(output).toContain(
      "| The icon.<br />@example <pre><code>&lt;Button><br />  &lt;Icon /><br />&lt;/Button></code></pre> |\n",
    );
  });
});
