import { asRelativeSourcePath } from "../src/brands";
import { MODULE_EXTENSIONS, normalizeSeparators, WATCH_RELEVANT_EXT_REGEX } from "../src/path";

describe("normalizeSeparators", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("handles Unix-style paths (no change needed)", () => {
    expect<string>(normalizeSeparators("./src/components/Button.svelte")).toBe("./src/components/Button.svelte");
    expect<string>(normalizeSeparators("/usr/local/bin")).toBe("/usr/local/bin");
    expect<string>(normalizeSeparators("relative/path/to/file.js")).toBe("relative/path/to/file.js");
  });

  test("converts Windows-style backslashes to forward slashes", () => {
    // Mock Windows separator
    vi.mock("path", () => ({ sep: "\\" }));

    expect<string>(normalizeSeparators(".\\src\\components\\Button.svelte")).toBe("./src/components/Button.svelte");
    expect<string>(normalizeSeparators("C:\\Users\\test\\project")).toBe("C:/Users/test/project");
  });

  test("handles mixed separators", () => {
    expect<string>(normalizeSeparators("./src\\components/Button.svelte")).toBe("./src/components/Button.svelte");
  });

  test("handles empty string", () => {
    expect<string>(normalizeSeparators("")).toBe("");
  });

  test("handles single file name without path", () => {
    expect<string>(normalizeSeparators("file.txt")).toBe("file.txt");
  });

  test("handles paths with multiple consecutive separators", () => {
    expect<string>(normalizeSeparators("./src//components///Button.svelte")).toBe("./src//components///Button.svelte");
  });

  test("handles relative paths", () => {
    expect<string>(normalizeSeparators("../parent/file.js")).toBe("../parent/file.js");
    expect<string>(normalizeSeparators("../../grandparent/file.js")).toBe("../../grandparent/file.js");
  });
});

describe("WATCH_RELEVANT_EXT_REGEX", () => {
  test("matches every kind of module a component can read values from", () => {
    for (const extension of [".svelte", ...MODULE_EXTENSIONS]) {
      expect(WATCH_RELEVANT_EXT_REGEX.test(`a${extension}`)).toBe(true);
    }
    expect(WATCH_RELEVANT_EXT_REGEX.test("a.json")).toBe(false);
    expect(WATCH_RELEVANT_EXT_REGEX.test("a.css")).toBe(false);
  });
});

describe("asRelativeSourcePath", () => {
  test("prefixes `./` unless the path is already relative", () => {
    expect<string>(asRelativeSourcePath("Button.svelte")).toBe("./Button.svelte");
    expect<string>(asRelativeSourcePath(".hidden/Button.svelte")).toBe("./.hidden/Button.svelte");
    expect<string>(asRelativeSourcePath("./Button.svelte")).toBe("./Button.svelte");
    expect<string>(asRelativeSourcePath("../Button.svelte")).toBe("../Button.svelte");
    expect<string>(asRelativeSourcePath("")).toBe("");
  });
});
