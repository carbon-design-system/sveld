import { asNormalizedPath } from "../src/brands";
import type { AppendType } from "../src/writer/WriterMarkdown";
import WriterMarkdown from "../src/writer/WriterMarkdown";
import { writeMarkdownCore } from "../src/writer/writer-markdown-core";

describe("WriterMarkdown", () => {
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
    expect(output).toContain("**Type parameters:** <code><Row extends DataTableRow = DataTableRow></code>");
    expect(output).toContain("| rows | Yes | <code>let</code> | No | -- | <code>ReadonlyArray<Row></code> | -- | -- |");
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
});
