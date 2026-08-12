import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * `ParseCache`'s global layer defaults to on and writes to
 * `$XDG_CACHE_HOME/sveld` (see `resolveGlobalCacheFilePath`). Without this,
 * the suite would read/write the real developer machine's `~/.cache/sveld`
 * during every test run, and — worse — tests across the suite that happen
 * to parse byte-identical `.svelte` fixtures (a common pattern; several
 * files reuse near-identical boilerplate) could get unexpected cross-test
 * cache hits, silently changing which code path a test actually exercises.
 *
 * Pointing `XDG_CACHE_HOME` at a fresh, empty directory before every single
 * test (not just once for the whole suite) makes the global cache visible
 * only within one test's own body, so a test that intentionally runs
 * `generateBundle` twice to exercise cross-project sharing still sees its
 * own writes, while no state ever leaks in from — or out to — any other
 * test or the real machine.
 */
let sandboxDir: string;
let originalXdgCacheHome: string | undefined;

beforeEach(() => {
  originalXdgCacheHome = process.env.XDG_CACHE_HOME;
  sandboxDir = mkdtempSync(join(tmpdir(), "sveld-xdg-cache-sandbox-"));
  process.env.XDG_CACHE_HOME = sandboxDir;
});

afterEach(() => {
  if (originalXdgCacheHome === undefined) {
    delete process.env.XDG_CACHE_HOME;
  } else {
    process.env.XDG_CACHE_HOME = originalXdgCacheHome;
  }
  rmSync(sandboxDir, { recursive: true, force: true });
});
