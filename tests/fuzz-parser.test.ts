import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * `SVELD_FUZZ_FORCE_CRASH` makes `fuzz-trial.ts` exit non-zero unconditionally
 * (see scripts/fuzz-trial.ts), so this doesn't depend on any real parser bug
 * to exercise `fuzz-parser.ts`'s findings-to-exit-code path. A fixed `--seed`
 * keeps which mutation lands deterministic.
 */
test("exits non-zero and writes a finding when a trial reports a finding", async () => {
  const findingsDir = mkdtempSync(join(tmpdir(), "sveld-fuzz-smoke-"));

  try {
    const proc = Bun.spawn({
      cmd: ["bun", "scripts/fuzz-parser.ts", "--iterations", "5", "--seed", "1", "--findings-dir", findingsDir],
      cwd: join(import.meta.dir, ".."),
      env: { ...process.env, SVELD_FUZZ_FORCE_CRASH: "1" },
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    expect(exitCode).not.toBe(0);
    expect(readdirSync(findingsDir).length).toBeGreaterThan(0);
  } finally {
    rmSync(findingsDir, { recursive: true, force: true });
  }
}, 10_000);
