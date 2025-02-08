import type { AppendType } from "../src/writer/WriterMarkdown";
import WriterMarkdown from "../src/writer/WriterMarkdown";

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
});
