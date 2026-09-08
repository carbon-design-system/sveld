import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ComponentProp, ComponentSlot, SerializedComponentEvent, TypeDef } from "../src/ComponentParser";
import { setQuiet } from "../src/logger";
import { normalizeSeparators } from "../src/path";
import type { ComponentDocs } from "../src/plugin";
import writeLlms, { renderLlmsDocuments } from "../src/writer/writer-llms";
import { mockComponentDocApi } from "./test-brands";

function mockProp(name: string, overrides?: Partial<ComponentProp>): ComponentProp {
  return {
    name,
    kind: "let",
    constant: false,
    isFunction: false,
    isFunctionDeclaration: false,
    isRequired: true,
    reactive: false,
    ...overrides,
  };
}

function mockEvent(name: string, overrides?: Partial<SerializedComponentEvent>): SerializedComponentEvent {
  return {
    type: "dispatched",
    name,
    ...overrides,
  } as SerializedComponentEvent;
}

function mockSlot(overrides?: Partial<ComponentSlot>): ComponentSlot {
  return {
    default: true,
    ...overrides,
  };
}

// A Svelte 5 runes component with a generic type parameter.
const dataTable = mockComponentDocApi("DataTable", "DataTable.svelte", {
  syntaxMode: "runes",
  componentComment: "A table for displaying rows of data.\n\nSupports sorting and row selection.",
  generics: ["Row", "Row extends DataTableRow"],
  props: [
    mockProp("rows", { type: "Row[]", isRequired: true, description: "The rows to display." }),
    mockProp("selected", {
      type: "Row | null",
      value: "null",
      isRequired: false,
      reactive: true,
      bindable: true,
      description: "The currently selected row.",
    }),
  ],
  slots: [mockSlot({ default: false, name: "row", slot_props: "{ row: Row }", description: "Custom row rendering." })],
});

// A legacy (Svelte 4-style) component with dispatched/forwarded events and slots.
const modal = mockComponentDocApi("Modal", "Modal.svelte", {
  syntaxMode: "legacy",
  componentComment: "A modal dialog.",
  props: [
    mockProp("open", {
      type: "boolean",
      value: "false",
      isRequired: false,
      reactive: true,
      binding: "writable",
      description: "Whether the modal is open.",
    }),
    mockProp("size", { type: '"sm" | "md" | "lg"', value: '"md"', isRequired: false, description: "Modal size." }),
  ],
  slots: [
    mockSlot({ default: true, description: "Modal body content." }),
    mockSlot({ default: false, name: "footer", description: "Modal footer content." }),
  ],
  events: [
    mockEvent("close", { detail: "null", description: "Fired when the modal closes." }),
    mockEvent("submit", {
      type: "forwarded",
      element: { type: "Element", name: "form" },
      description: "Forwarded native submit event.",
    } as unknown as Partial<SerializedComponentEvent>),
  ],
});

// A component with a typedef and a module-level export.
const select = mockComponentDocApi("Select", "Select.svelte", {
  syntaxMode: "legacy",
  props: [mockProp("value", { type: "SelectOption", isRequired: false, description: "The selected option." })],
  typedefs: [
    {
      name: "SelectOption",
      type: "{ label: string; value: string }",
      ts: "interface SelectOption {\n  label: string;\n  value: string;\n}",
      description: "An option in the select.",
    } satisfies TypeDef,
  ],
  moduleExports: [
    mockProp("DEFAULT_OPTION", {
      kind: "const",
      constant: true,
      type: "SelectOption",
      value: '{ label: "None", value: "" }',
      isRequired: false,
      description: "The default option.",
    }),
  ],
});

const components: ComponentDocs = new Map([
  ["DataTable", dataTable],
  ["Modal", modal],
  ["Select", select],
]);

describe("renderLlmsDocuments", () => {
  test("llms.txt lists every component with a link and a one-line summary", () => {
    const { llmsTxt } = renderLlmsDocuments(components, { title: "my-library", summary: "A component library." });

    expect(llmsTxt).toMatchSnapshot();
    expect(llmsTxt).toStartWith("# my-library\n\n> A component library.\n\n## Components\n\n");
    expect(llmsTxt).toContain("- [DataTable](/DataTable): A table for displaying rows of data.\n");
    expect(llmsTxt).toContain("- [Modal](/Modal): A modal dialog.\n");
    expect(llmsTxt).toContain("- [Select](/Select): Component\n");
  });

  test("llms.txt respects a custom linkBase", () => {
    const { llmsTxt } = renderLlmsDocuments(components, { title: "my-library", linkBase: "/docs/components" });

    expect(llmsTxt).toContain("- [DataTable](/docs/components/DataTable): ");
  });

  test("llms.txt adds an Exports section when entryExports is set", () => {
    const { llmsTxt } = renderLlmsDocuments(components, {
      title: "my-library",
      summary: "A component library.",
      entryExports: [
        {
          name: "VERSION",
          kind: "const",
          value: '"1.0.0"',
          description: "The current package version.",
          isTypeOnly: false,
        },
        { name: "Theme", kind: "type", type: '"light" | "dark"', isTypeOnly: true },
      ],
    });

    expect(llmsTxt).toMatchSnapshot();
    expect(llmsTxt).toContain("## Exports\n\n- `VERSION`: The current package version.\n- `Theme`: type\n");
  });

  test("llms.txt omits the Exports section when entryExports is empty", () => {
    const { llmsTxt } = renderLlmsDocuments(components, { title: "my-library" });

    expect(llmsTxt).not.toContain("## Exports");
  });

  test("llms-full.txt renders per-component Props/Bindings/Events/Slots/Typedefs/Module exports", () => {
    const { llmsFullTxt } = renderLlmsDocuments(components, { title: "my-library", summary: "A component library." });

    expect(llmsFullTxt).toMatchSnapshot();

    // DataTable: runes + generics + a bindable prop + a snippet.
    expect(llmsFullTxt).toContain("## DataTable");
    expect(llmsFullTxt).toContain("Type parameters:");
    expect(llmsFullTxt).toContain("A table for displaying rows of data.\n\nSupports sorting and row selection.");
    expect(llmsFullTxt).toContain("| Name | Type | Default | Required | Description |");
    expect(llmsFullTxt).toContain("### Bindings");
    expect(llmsFullTxt).toContain("### Snippets");

    // Modal: legacy + events + slots.
    expect(llmsFullTxt).toContain("## Modal");
    expect(llmsFullTxt).toContain("### Events");
    expect(llmsFullTxt).toContain("### Slots");

    // Select: typedefs + module exports.
    expect(llmsFullTxt).toContain("## Select");
    expect(llmsFullTxt).toContain("### Typedefs");
    expect(llmsFullTxt).toContain("```ts\n/**\n * An option in the select.\n */\nexport interface SelectOption {");
    expect(llmsFullTxt).toContain("### Module exports");
    expect(llmsFullTxt).toContain("DEFAULT_OPTION");
  });

  test("props and events tables render pass-through tags like slots do", () => {
    const example = mockComponentDocApi("Example", "Example.svelte", {
      syntaxMode: "legacy",
      props: [
        mockProp("size", {
          description: "Current value.",
          tags: [{ name: "since", body: "1.2.0" }],
        }),
      ],
      events: [
        mockEvent("change", {
          description: "Fires on change.",
          tags: [{ name: "example", body: "on:change={handleChange}" }],
        }),
      ],
    });

    const { llmsFullTxt } = renderLlmsDocuments(new Map([["Example", example]]), { title: "my-library" });

    expect(llmsFullTxt).toContain("Current value.<br />@since 1.2.0");
    expect(llmsFullTxt).toContain("Fires on change.<br />@example on:change={handleChange}");
  });

  test("omits empty sections entirely", () => {
    const { llmsFullTxt } = renderLlmsDocuments(new Map([["Select", select]]), { title: "my-library" });

    expect(llmsFullTxt).not.toContain("### Bindings");
    expect(llmsFullTxt).not.toContain("### Events");
    expect(llmsFullTxt).not.toContain("### Slots");
    expect(llmsFullTxt).not.toContain("### Snippets");
  });

  test("uses Snippets for runes components and Slots for legacy components", () => {
    const { llmsFullTxt: dataTableOnly } = renderLlmsDocuments(new Map([["DataTable", dataTable]]), {
      title: "my-library",
    });
    expect(dataTableOnly).toContain("### Snippets");
    expect(dataTableOnly).not.toContain("### Slots");

    const { llmsFullTxt: modalOnly } = renderLlmsDocuments(new Map([["Modal", modal]]), { title: "my-library" });
    expect(modalOnly).toContain("### Slots");
    expect(modalOnly).not.toContain("### Snippets");
  });
});

describe("writeLlms", () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    setQuiet(false);
    jest.restoreAllMocks();
  });

  test("writes llms.txt and llms-full.txt to outDir, matching renderLlmsDocuments", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sveld-llms-"));
    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const options = { outDir: "docs", title: "my-library", summary: "A component library." };
      await writeLlms(components, options);

      const { llmsTxt, llmsFullTxt } = renderLlmsDocuments(components, options);
      expect(readFileSync(join(tempDir, "docs", "llms.txt"), "utf-8")).toBe(llmsTxt);
      expect(readFileSync(join(tempDir, "docs", "llms-full.txt"), "utf-8")).toBe(llmsFullTxt);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('created "docs/llms.txt".'));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('created "docs/llms-full.txt".'));

      errorSpy.mockClear();
      await writeLlms(components, options);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('unchanged "docs/llms.txt".'));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('unchanged "docs/llms-full.txt".'));
    } finally {
      process.chdir(previousCwd);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("dry-run reports the resolved paths and writes nothing to disk", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sveld-llms-dry-run-"));
    const previousCwd = process.cwd();
    process.chdir(tempDir);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      await writeLlms(components, { dryRun: true });

      const cwd = process.cwd();
      expect(existsSync(join(tempDir, "llms.txt"))).toBe(false);
      expect(existsSync(join(tempDir, "llms-full.txt"))).toBe(false);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`would write "${normalizeSeparators(join(cwd, "llms.txt"))}"`),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`would write "${normalizeSeparators(join(cwd, "llms-full.txt"))}"`),
      );
    } finally {
      process.chdir(previousCwd);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("defaults title/summary from the project's package.json when unset", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sveld-llms-pkg-"));
    const previousCwd = process.cwd();
    process.chdir(tempDir);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "carbon-components-svelte",
        description: "Svelte components for IBM's Carbon Design System.",
      }),
    );

    try {
      await writeLlms(components, {});

      const llmsTxt = readFileSync(join(tempDir, "llms.txt"), "utf-8");
      expect(llmsTxt).toStartWith(
        "# carbon-components-svelte\n\n> Svelte components for IBM's Carbon Design System.\n\n",
      );
    } finally {
      process.chdir(previousCwd);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
