import * as fs from "fs";
import * as path from "path";
import { getSvelteEntry } from "../src/get-svelte-entry";

describe("getSvelteEntry", () => {
  const mockCwd = "/mock/project";

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, "cwd").mockReturnValue(mockCwd);
    jest.spyOn(path, "join").mockImplementation((...args) => args.join("/"));
    jest.spyOn(fs, "existsSync");
    jest.spyOn(fs, "readFileSync");
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("returns explicit entry point if valid", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);

    const result = getSvelteEntry("src/Component.svelte");

    expect(result).toBe("src/Component.svelte");
    expect(fs.existsSync).toHaveBeenCalledWith(`${mockCwd}/src/Component.svelte`);
  });

  test("returns null if explicit entry point is invalid", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    const result = getSvelteEntry("src/NonExistent.svelte");

    expect(result).toBeNull();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Invalid entry point"));
  });

  test("returns svelte field from package.json if no entry point provided", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({ svelte: "src/index.js" }));

    const result = getSvelteEntry();

    expect(result).toBe("src/index.js");
    expect(fs.readFileSync).toHaveBeenCalledWith(`${mockCwd}/package.json`, "utf-8");
  });

  test("returns null if package.json exists but has no svelte field", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({ main: "index.js" }));

    const result = getSvelteEntry();

    expect(result).toBeNull();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Could not determine an entry point"));
  });

  test("returns null if package.json does not exist", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    const result = getSvelteEntry();

    expect(result).toBeNull();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Could not locate a package.json file"));
  });

  test.skip("handles malformed package.json", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "readFileSync").mockReturnValue("invalid json");

    expect(() => getSvelteEntry()).toThrow();
    expect(console.error).toHaveBeenCalled();
  });

  test("handles empty string entry point", () => {
    const result = getSvelteEntry("");

    expect(result).toBeNull();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Could not locate a package.json file."));
  });

  test("handles undefined svelte field in package.json", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({ svelte: undefined }));

    const result = getSvelteEntry();
    expect(result).toBeNull();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Could not determine an entry point"));
  });
});
