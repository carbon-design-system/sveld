import path from "node:path";
import { Glob } from "bun";
import { parse as realParse, VERSION as realVersion } from "svelte/compiler";
import { parse as shimParse, VERSION as shimVersion } from "../src/svelte-parse";

/**
 * src/svelte-parse.ts reimplements svelte/compiler's `parse` and `VERSION`
 * against svelte's internal, undocumented module paths (see that file's
 * top-of-file comment for why). Those paths aren't covered by svelte's
 * package.json#exports or semver contract, so a svelte upgrade could shift
 * their shape without warning. This test is the guard: it byte-compares the
 * shim's output against the real svelte/compiler across every fixture in the
 * repo. If it starts failing after bumping the svelte devDependency, the shim
 * (src/svelte-parse.ts) needs to be re-synced against svelte's current
 * internals, not just have this test updated.
 */

const root = path.join(process.cwd(), "tests");
const files: string[] = [];

for await (const file of new Glob("**/*.svelte").scan(root)) {
  files.push(path.join(root, file));
}

test("found a substantial number of fixture .svelte files to compare against", () => {
  expect(files.length).toBeGreaterThan(100);
});

test("VERSION matches the real svelte/compiler", () => {
  expect(shimVersion).toBe(realVersion);
});

describe("parse() output matches svelte/compiler byte-for-byte", () => {
  for (const file of files) {
    const relative = path.relative(root, file);

    test(relative, async () => {
      const source = await Bun.file(file).text();

      for (const modern of [true, false] as const) {
        for (const loose of [true, false] as const) {
          // realParse's overload pair (modern: true vs false/undefined selects a different return
          // type) can't express "dynamic boolean" - this test intentionally iterates both branches.
          // biome-ignore lint/suspicious/noExplicitAny: see above
          const options = { modern, loose } as any;

          let real: unknown;
          let realError: string | undefined;
          try {
            real = realParse(source, options);
          } catch (error) {
            realError = String(error);
          }

          let shim: unknown;
          let shimError: string | undefined;
          try {
            shim = shimParse(source, { modern, loose });
          } catch (error) {
            shimError = String(error);
          }

          const label = `modern=${modern} loose=${loose}`;
          expect([label, shimError]).toEqual([label, realError]);
          if (!realError) {
            expect(JSON.stringify(shim)).toBe(JSON.stringify(real));
          }
        }
      }
    });
  }
});
