import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Writer, { createJsonWriter, createTypeScriptWriter } from "../src/writer/Writer";

describe("Writer", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sveld-writer-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("writes raw content as-is, without formatting", async () => {
    const writer = new Writer();
    const filePath = join(dir, "index.d.ts");

    await writer.write(filePath, "export type Props={a:boolean}");

    expect(await readFile(filePath, "utf-8")).toBe("export type Props={a:boolean}");
  });

  test("creates missing parent directories", async () => {
    const writer = new Writer();
    const filePath = join(dir, "nested", "deep", "index.d.ts");

    await writer.write(filePath, "content");

    expect(await readFile(filePath, "utf-8")).toBe("content");
  });

  test("createJsonWriter writes raw content as-is", async () => {
    const writer = createJsonWriter();
    const filePath = join(dir, "data.json");

    await writer.write(filePath, '{"a":null}');

    expect(await readFile(filePath, "utf-8")).toBe('{"a":null}');
  });

  test("createTypeScriptWriter writes raw content as-is", async () => {
    const writer = createTypeScriptWriter();
    const filePath = join(dir, "index.d.ts");

    await writer.write(filePath, "export type Props = {};");

    expect(await readFile(filePath, "utf-8")).toBe("export type Props = {};");
  });

  test("returns true and writes when the file doesn't exist yet", async () => {
    const writer = new Writer();
    const filePath = join(dir, "index.d.ts");

    await expect(writer.write(filePath, "content")).resolves.toBe(true);
    expect(await readFile(filePath, "utf-8")).toBe("content");
  });

  test("returns false and skips the write when content is unchanged", async () => {
    const writer = new Writer();
    const filePath = join(dir, "index.d.ts");

    await writer.write(filePath, "content");
    const mtimeBefore = (await stat(filePath)).mtimeMs;

    await expect(writer.write(filePath, "content")).resolves.toBe(false);

    expect((await stat(filePath)).mtimeMs).toBe(mtimeBefore);
    expect(await readFile(filePath, "utf-8")).toBe("content");
  });

  test("returns true and overwrites when content has changed", async () => {
    const writer = new Writer();
    const filePath = join(dir, "index.d.ts");

    await writeFile(filePath, "old content");

    await expect(writer.write(filePath, "new content")).resolves.toBe(true);
    expect(await readFile(filePath, "utf-8")).toBe("new content");
  });
});
