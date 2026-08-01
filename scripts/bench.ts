/**
 * Benchmarks the sveld pipeline (`generateBundle` → `writeOutput`) against a
 * real component library. Defaults to the carbon e2e fixture (~160 components).
 *
 * Usage:
 *   bun run bench                  # 3 runs, no parse cache
 *   bun run bench --runs 5
 *   bun run bench --cache          # scratch parse cache: run 1 cold, later runs warm
 *   bun run bench --entry <path>   # benchmark another entry point (glob discovery)
 *   bun run bench --reuse-outdir   # write every run into the same out dir, so
 *                                  # run 1 populates it and runs 2+ exercise the
 *                                  # writer's skip-unchanged-file path
 *   bun run bench --stages         # also split the types writer into
 *                                  # writeTsDefinition generation vs Writer I/O
 *
 * The write phase is timed per built-in writer (types/json/markdown) rather
 * than as one opaque span, since `types` dominates it in practice.
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
import { dirname, join, relative, resolve } from "node:path";
import { generateBundle } from "../src/bundle";
import { setQuiet } from "../src/logger";
// Side-effect import: registers the built-in writers ("types"/"json"/"markdown")
// with the registry, same as src/plugin.ts does.
import "../src/writer/built-in-writers";
import { convertSvelteExt, createExports } from "../src/create-exports";
import { buildComponentApiDocument } from "../src/writer/document-model";
import { getWriter } from "../src/writer/registry";
import Writer from "../src/writer/Writer";
import { writeTsDefinition } from "../src/writer/writer-ts-definitions-core";

const DEFAULT_ENTRY = join(import.meta.dir, "..", "tests", "e2e", "carbon", "src", "index.js");
const DEFAULT_RUNS = 3;

interface BenchArgs {
  runs: number;
  cache: boolean;
  entry: string;
  reuseOutDir: boolean;
  stages: boolean;
}

interface RunTiming {
  parse: number;
  types: number;
  json: number;
  markdown: number;
  total: number;
  /** Only populated with `--stages`: writeTsDefinition generation vs Writer I/O. */
  typesGenerate?: number;
  typesIo?: number;
}

function parseArgs(argv: string[]): BenchArgs {
  const args: BenchArgs = {
    runs: DEFAULT_RUNS,
    cache: false,
    entry: DEFAULT_ENTRY,
    reuseOutDir: false,
    stages: false,
  };

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
      case "--reuse-outdir":
        args.reuseOutDir = true;
        break;
      case "--stages":
        args.stages = true;
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
        console.error(
          `bench: unknown flag "${flag}". Flags: --runs <n>, --cache, --entry <path>, --reuse-outdir, --stages.`,
        );
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

function formatTiming(timing: RunTiming, stages: boolean): string {
  const parts = [
    `parse ${timing.parse.toFixed(0)}ms`,
    `types ${timing.types.toFixed(0)}ms`,
    `json ${timing.json.toFixed(0)}ms`,
    `markdown ${timing.markdown.toFixed(0)}ms`,
  ];
  if (stages && timing.typesGenerate !== undefined && timing.typesIo !== undefined) {
    parts.push(`types-generate ${timing.typesGenerate.toFixed(1)}ms`, `types-io ${timing.typesIo.toFixed(1)}ms`);
  }
  parts.push(`total ${timing.total.toFixed(0)}ms`);
  return parts.join("  ");
}

// Mirrors writeTsDefinitions (src/writer/writer-ts-definitions.ts), including
// its generated-text cache lookup, but times generation separately from I/O
// (Writer.write) — the boundary the cache moves. Used instead of the "types"
// writer directly when `--stages` is passed.
async function timeTypesStages(
  result: Awaited<ReturnType<typeof generateBundle>>,
): Promise<{ typesGenerate: number; typesIo: number }> {
  const writer = new Writer({});
  const document = buildComponentApiDocument(result.allComponentsForTypes);
  const cacheFormatKey = "class";

  const generateStart = performance.now();
  const generated = document.components.map((component) => {
    const resolvedPath = result.resolvedPathByModule?.get(component.moduleName);
    let text = resolvedPath ? result.cache?.getGeneratedText(resolvedPath, cacheFormatKey) : undefined;
    if (text === undefined) {
      text = writeTsDefinition(component, { format: undefined });
      if (resolvedPath) result.cache?.setGeneratedText(resolvedPath, cacheFormatKey, text);
    }
    return { filePath: convertSvelteExt(join("types", component.filePath)), text };
  });
  const indexDts = `${createExports(result.exports)}\n`;
  const typesGenerate = performance.now() - generateStart;

  const ioStart = performance.now();
  await Promise.all([
    ...generated.map((g) => writer.write(g.filePath, g.text)),
    writer.write(join("types", "index.d.ts"), indexDts),
  ]);
  const typesIo = performance.now() - ioStart;

  return { typesGenerate, typesIo };
}

async function benchOnce(
  input: string,
  cacheFile: string | undefined,
  outDir: string,
  stages: boolean,
): Promise<RunTiming> {
  mkdirSync(outDir, { recursive: true });

  const start = performance.now();
  // generateBundle enables the on-disk parse cache unless `cache` is explicitly
  // false, so an undefined cacheFile must be mapped to false or the "cache off"
  // runs silently read the warm cache in node_modules/.cache/sveld/.
  const result = await generateBundle(input, true, { cache: cacheFile ?? false });
  const parsed = performance.now();

  // Every writer resolves its output paths against process.cwd(); run the
  // write phase from the scratch directory so nothing lands in the fixture.
  const originalCwd = process.cwd();
  process.chdir(outDir);
  // The writers log one "created ..." line per emitted file (160+ per run on
  // the carbon fixture), which would drown the timing output. Errors still go
  // to `console.error` directly (not through the logger), so parse failures
  // remain visible.
  setQuiet(true);
  const inputDir = dirname(input);
  let types = 0;
  let json = 0;
  let markdown = 0;
  let stageTimes: { typesGenerate: number; typesIo: number } | undefined;
  try {
    if (stages) {
      // Bypasses the registered "types" writer so generation and I/O are
      // timed separately instead of double-counted.
      stageTimes = await timeTypesStages(result);
      types = stageTimes.typesGenerate + stageTimes.typesIo;
    } else {
      const typesWriter = getWriter("types");
      if (!typesWriter) throw new Error('sveld bench: built-in writer "types" is not registered.');
      const typesStart = performance.now();
      await typesWriter.write(result.allComponentsForTypes, {
        outDir: "types",
        preamble: "",
        exports: result.exports,
        inputDir,
        dryRun: false,
        cache: result.cache,
        resolvedPathByModule: result.resolvedPathByModule,
      });
      types = performance.now() - typesStart;
    }
    // Persists the generated-text cache populated above, same as a real run
    // (writeOutput callers save a second time after writing); otherwise the
    // next run's fresh ParseCache would never see it.
    result.cache?.save();

    const jsonWriter = getWriter("json");
    if (!jsonWriter) throw new Error('sveld bench: built-in writer "json" is not registered.');
    const jsonStart = performance.now();
    await jsonWriter.write(result.components, {
      outFile: "COMPONENT_API.json",
      input,
      inputDir,
      entryExports: result.entryExports,
      dryRun: false,
    });
    json = performance.now() - jsonStart;

    const markdownWriter = getWriter("markdown");
    if (!markdownWriter) throw new Error('sveld bench: built-in writer "markdown" is not registered.');
    const markdownStart = performance.now();
    await markdownWriter.write(result.components, {
      outFile: "COMPONENT_INDEX.md",
      entryExports: result.entryExports,
      dryRun: false,
    });
    markdown = performance.now() - markdownStart;
  } finally {
    setQuiet(false);
    process.chdir(originalCwd);
  }
  const written = performance.now();

  return {
    parse: parsed - start,
    types,
    json,
    markdown,
    total: written - start,
    typesGenerate: stageTimes?.typesGenerate,
    typesIo: stageTimes?.typesIo,
  };
}

const args = parseArgs(process.argv.slice(2));
const workDir = mkdtempSync(join(tmpdir(), "sveld-bench-"));
const cacheFile = args.cache ? join(workDir, "parse-cache.json") : undefined;
const cacheLabel = args.cache ? "cache on (run 1 cold, later runs warm)" : "cache off";
// With --reuse-outdir every run writes into the same directory, so run 1
// populates it and runs 2+ exercise the writer's skip-unchanged-file path.
// Without it, each run gets its own fresh temp dir and every write is a miss.
const sharedOutDir = args.reuseOutDir ? join(workDir, "out") : undefined;
const outDirLabel = args.reuseOutDir ? ", reuse outdir" : "";

console.log(`sveld bench: ${relative(process.cwd(), args.entry)} — ${args.runs} run(s), ${cacheLabel}${outDirLabel}`);

const timings: RunTiming[] = [];
try {
  for (let run = 1; run <= args.runs; run++) {
    // biome-ignore lint/performance/noAwaitInLoops: runs must execute sequentially so each phase is timed in isolation.
    const timing = await benchOnce(args.entry, cacheFile, sharedOutDir ?? join(workDir, `run-${run}`), args.stages);
    timings.push(timing);
    console.log(`run ${run}  ${formatTiming(timing, args.stages)}`);
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

if (timings.length > 1) {
  const summary: RunTiming = {
    parse: median(timings.map((timing) => timing.parse)),
    types: median(timings.map((timing) => timing.types)),
    json: median(timings.map((timing) => timing.json)),
    markdown: median(timings.map((timing) => timing.markdown)),
    total: median(timings.map((timing) => timing.total)),
    typesGenerate: args.stages ? median(timings.map((timing) => timing.typesGenerate ?? 0)) : undefined,
    typesIo: args.stages ? median(timings.map((timing) => timing.typesIo ?? 0)) : undefined,
  };
  console.log(`median ${formatTiming(summary, args.stages)}`);
}
