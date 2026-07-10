import { readFileSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { setQuiet } from "../src/logger";
import type { ComponentDocs } from "../src/plugin";
import writeMarkdown, { renderMarkdownDocument } from "../src/writer/writer-markdown";
import { mockComponentDocApi } from "./test-brands";

describe("writeMarkdown", () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    setQuiet(false);
    jest.restoreAllMocks();
  });

  test("prints the progress line to stderr", async () => {
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-md-"));
    const outFile = path.relative(process.cwd(), path.join(tempDir, "COMPONENT_INDEX.md"));
    const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);

    try {
      await writeMarkdown(components, { outFile });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`created "${outFile}".`));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("suppresses the progress line when quiet mode is on", async () => {
    setQuiet(true);
    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-md-"));
    const outFile = path.relative(process.cwd(), path.join(tempDir, "COMPONENT_INDEX.md"));
    const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);

    try {
      await writeMarkdown(components, { outFile });
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("does not print a progress line when write is false", async () => {
    const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);

    await writeMarkdown(components, { outFile: "unused.md", write: false });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  test("renderMarkdownDocument matches the document writeMarkdown writes to disk", async () => {
    const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);
    const rendered = renderMarkdownDocument(components, {});

    const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-sveld-md-render-"));
    const outFile = path.relative(process.cwd(), path.join(tempDir, "COMPONENT_INDEX.md"));

    try {
      await writeMarkdown(components, { outFile });
      const written = readFileSync(path.join(tempDir, "COMPONENT_INDEX.md"), "utf-8");

      expect(rendered).toBe(written);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
