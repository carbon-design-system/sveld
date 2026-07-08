/**
 * Benchmarks the sveld pipeline (`generateBundle` → `writeOutput`) against a
 * real component library. Defaults to the carbon e2e fixture (~160 components).
 *
 * Usage:
 *   bun run bench                  # 3 runs, no parse cache
 *   bun run bench --runs 5
 *   bun run bench --cache          # scratch parse cache: run 1 cold, later runs warm
 *   bun run bench --entry <path>   # benchmark another entry point (glob discovery)
 *
 * All output (types/JSON/Markdown and the parse cache) is written to a temp
 * directory, so benchmarking never touches a fixture's committed files.
 *
 * Runs share one process, so run 1 includes JIT warmup. Wall-clock times also
 * swing with machine load; compare medians from the same invocation on a quiet
 * machine rather than absolute numbers across sessions.
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { generateBundle } from "../src/bundle";
import { writeOutput } from "../src/plugin";

const DEFAULT_ENTRY = join(import.meta.dir, "..", "tests", "e2e", "carbon", "src", "index.js");
const DEFAULT_RUNS = 3;

interface BenchArgs {
  runs: number;
  cache: boolean;
  entry: string;
}

interface RunTiming {
  parse: number;
  write: number;
  total: number;
}

function parseArgs(argv: string[]): BenchArgs {
  const args: BenchArgs = { runs: DEFAULT_RUNS, cache: false, entry: DEFAULT_ENTRY };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case "--runs": {
        const value = Number.parseInt(argv[++i] ?? "", 10);
        if (Number.isNaN(value) || value < 1) {
          console.error("bench: --runs expects a positive integer.");
          process.exit(1);
        }
        args.runs = value;
        break;
      }
      case "--cache":
        args.cache = true;
        break;
      case "--entry": {
        const value = argv[++i];
        if (value === undefined) {
          console.error("bench: --entry expects a path.");
          process.exit(1);
        }
        args.entry = resolve(value);
        break;
      }
      default:
        console.error(`bench: unknown flag "${flag}". Flags: --runs <n>, --cache, --entry <path>.`);
        process.exit(1);
    }
  }

  return args;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function formatTiming(timing: RunTiming): string {
  const parse = `parse ${timing.parse.toFixed(0)}ms`;
  const write = `write ${timing.write.toFixed(0)}ms`;
  const total = `total ${timing.total.toFixed(0)}ms`;
  return `${parse}  ${write}  ${total}`;
}

/**
 * The writers log one "created ..." line per emitted file (160+ per run on
 * the carbon fixture), which would drown the timing output. Errors still go
 * to `console.error`, so parse failures remain visible.
 */
function silenceLogs(): () => void {
  const original = console.log;
  console.log = () => {};
  return () => {
    console.log = original;
  };
}

async function benchOnce(input: string, cacheFile: string | undefined, outDir: string): Promise<RunTiming> {
  mkdirSync(outDir, { recursive: true });

  const start = performance.now();
  const result = await generateBundle(input, true, { cache: cacheFile });
  const parsed = performance.now();

  // Every writer resolves its output paths against process.cwd(); run the
  // write phase from the scratch directory so nothing lands in the fixture.
  const originalCwd = process.cwd();
  process.chdir(outDir);
  const restoreLogs = silenceLogs();
  try {
    await writeOutput(result, { types: true, json: true, markdown: true }, input);
  } finally {
    restoreLogs();
    process.chdir(originalCwd);
  }
  const written = performance.now();

  return { parse: parsed - start, write: written - parsed, total: written - start };
}

const args = parseArgs(process.argv.slice(2));
const workDir = mkdtempSync(join(tmpdir(), "sveld-bench-"));
const cacheFile = args.cache ? join(workDir, "parse-cache.json") : undefined;
const cacheLabel = args.cache ? "cache on (run 1 cold, later runs warm)" : "cache off";

console.log(`sveld bench: ${relative(process.cwd(), args.entry)} — ${args.runs} run(s), ${cacheLabel}`);

const timings: RunTiming[] = [];
try {
  for (let run = 1; run <= args.runs; run++) {
    // biome-ignore lint/performance/noAwaitInLoops: runs must execute sequentially so each phase is timed in isolation.
    const timing = await benchOnce(args.entry, cacheFile, join(workDir, `run-${run}`));
    timings.push(timing);
    console.log(`run ${run}  ${formatTiming(timing)}`);
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

if (timings.length > 1) {
  const summary: RunTiming = {
    parse: median(timings.map((timing) => timing.parse)),
    write: median(timings.map((timing) => timing.write)),
    total: median(timings.map((timing) => timing.total)),
  };
  console.log(`median ${formatTiming(summary)}`);
}
