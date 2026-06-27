import { asNormalizedPath } from "../src/brands";
import type { ComponentDocApi, ComponentDocs } from "../src/plugin";
import type { AppendType } from "../src/writer/WriterMarkdown";
import WriterMarkdown from "../src/writer/WriterMarkdown";
import { splitMarkdownCore, writeMarkdownCore } from "../src/writer/writer-markdown-core";

function createComponent(moduleName: string, overrides?: Partial<ComponentDocApi>): ComponentDocApi {
  return {
    moduleName,
    filePath: asNormalizedPath(`${moduleName}.svelte`),
    syntaxMode: "legacy",
    props: [],
    moduleExports: [],
    slots: [],
    events: [],
    typedefs: [],
    generics: null,
    rest_props: undefined,
    contexts: [],
    ...overrides,
  };
}

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

  test("single-file output is unchanged when no options are passed", () => {
    const components: ComponentDocs = new Map([
      ["Button", createComponent("Button")],
      ["Input", createComponent("Input")],
    ]);

    const baseline = writeMarkdownCore(components);
    expect(baseline).not.toContain("<a id=");
    expect(baseline).not.toContain("---\nname:");
    expect(baseline).toMatchSnapshot();
  });

  test("single-file output supports opt-in toc and anchors", () => {
    const components: ComponentDocs = new Map([
      [
        "Button",
        createComponent("Button", {
          typedefs: [{ type: "type ButtonSize = 'sm' | 'lg'", name: "ButtonSize", ts: "type ButtonSize" }],
          props: [
            {
              name: "size",
              kind: "let",
              constant: false,
              description: "Button size.",
              isFunction: false,
              isFunctionDeclaration: false,
              isRequired: false,
              reactive: false,
            },
          ],
          events: [{ type: "forwarded", name: "click", element: "button" }],
        }),
      ],
    ]);

    const output = writeMarkdownCore(components, { toc: true, anchors: true });

    expect(output).toContain('<a id="button"></a>');
    expect(output).toContain('<a id="button-props"></a>');
    expect(output).toContain("- [Types](#button-types)");
    expect(output).toContain("- [Events](#button-events)");
    expect(output).toMatchSnapshot();
  });

  test("split mode emits one document per component with frontmatter", () => {
    const components: ComponentDocs = new Map([
      [
        "Button",
        createComponent("Button", {
          componentComment: "A button.\n@since 1.2.0",
          props: [
            {
              name: "disabled",
              kind: "let",
              constant: false,
              description: "Disable the button.",
              isFunction: false,
              isFunctionDeclaration: false,
              isRequired: false,
              reactive: false,
            },
          ],
        }),
      ],
      [
        "LegacyInput",
        createComponent("LegacyInput", {
          componentComment: "@deprecated Use `Input` instead.",
        }),
      ],
    ]);

    const files = splitMarkdownCore(components, { frontmatter: true, toc: true, anchors: true });

    expect(Array.from(files.keys())).toEqual(["Button", "LegacyInput"]);

    const button = files.get("Button") ?? "";
    expect(button).toContain('name: "Button"');
    expect(button).toContain('since: "1.2.0"');
    expect(button).not.toContain("# Component Index");

    const legacy = files.get("LegacyInput") ?? "";
    expect(legacy).toContain('deprecated: "Use `Input` instead."');

    expect(button).toMatchSnapshot();
    expect(legacy).toMatchSnapshot();
  });

  test("split mode omits frontmatter when not requested", () => {
    const components: ComponentDocs = new Map([["Button", createComponent("Button")]]);

    const files = splitMarkdownCore(components);

    expect(files.get("Button")).not.toContain("---\nname:");
  });
});
