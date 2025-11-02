import { normalizeSeparators } from "../src/path";

describe("normalizeSeparators", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("handles Unix-style paths (no change needed)", () => {
    expect(normalizeSeparators("./src/components/Button.svelte")).toBe("./src/components/Button.svelte");
    expect(normalizeSeparators("/usr/local/bin")).toBe("/usr/local/bin");
    expect(normalizeSeparators("relative/path/to/file.js")).toBe("relative/path/to/file.js");
  });

  test("converts Windows-style backslashes to forward slashes", () => {
    // Mock Windows separator
    jest.mock("path", () => ({ sep: "\\" }));

    expect(normalizeSeparators(".\\src\\components\\Button.svelte")).toBe("./src/components/Button.svelte");
    expect(normalizeSeparators("C:\\Users\\test\\project")).toBe("C:/Users/test/project");
  });

  test("handles mixed separators", () => {
    expect(normalizeSeparators("./src\\components/Button.svelte")).toBe("./src/components/Button.svelte");
  });

  test("handles empty string", () => {
    expect(normalizeSeparators("")).toBe("");
  });

  test("handles single file name without path", () => {
    expect(normalizeSeparators("file.txt")).toBe("file.txt");
  });

  test("handles paths with multiple consecutive separators", () => {
    expect(normalizeSeparators("./src//components///Button.svelte")).toBe("./src//components///Button.svelte");
  });

  test("handles relative paths", () => {
    expect(normalizeSeparators("../parent/file.js")).toBe("../parent/file.js");
    expect(normalizeSeparators("../../grandparent/file.js")).toBe("../../grandparent/file.js");
  });
});
