import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sveld } from "../src/sveld";

const ENTRY_ERROR = /entry/i;

describe("sveld() entry resolution failures", () => {
  let dir: string;
  let previousCwd: string;

  beforeEach(() => {
    previousCwd = process.cwd();
    dir = mkdtempSync(join(tmpdir(), "sveld-entry-"));
    process.chdir(dir);
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(previousCwd);
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("throws when the given input does not resolve", async () => {
    await expect(sveld({ input: "does-not-exist/" })).rejects.toThrow(ENTRY_ERROR);
  });

  test("throws when no input is given and package.json#svelte is absent", async () => {
    await expect(sveld()).rejects.toThrow(ENTRY_ERROR);
  });
});
