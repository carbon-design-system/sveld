/**
 * Statistically rigorous microbenchmarks for sveld's hot paths, using mitata
 * (warmup, batching, outlier-aware percentiles) rather than the wall-clock
 * medians in `scripts/bench.ts` (which times the full pipeline / stages of
 * one real invocation instead of many statistically-sampled iterations).
 *
 * Covers, from a real fixture (the carbon e2e fixture, ~160 components):
 *   - parse: parseSvelteComponent on a small/medium/large real component
 *   - parse: parseSvelteComponent on a synthetic pathological component
 *     (200 props with wide union/generic JSDoc types) — realistic samples
 *     alone can't show worst-case type-resolution cost
 *   - write: writeTsDefinition on the parsed doc for those same components,
 *     including the pathological one
 *   - write: renderJsonDocument / renderMarkdownDocument (the pure,
 *     I/O-free cores the real json/markdown writers call) over all 160
 *   - document model: buildComponentApiDocument's sort/strip over all 160
 *   - cache: hashSource (sha256, paid once per file every run) and
 *     ParseCache.get on a hit vs. a miss
 *   - pipeline: generateBundle end-to-end, no cache
 *
 * Deliberately out of scope: Writer's actual disk I/O (fs write cost isn't
 * sveld logic) and the on-disk cache file read/write (`ParseCache.save`,
 * `readCacheFile`) — both are one-shot per run, not per-file hot paths.
 *
 * Usage:
 *   bun run bench:mitata
 *   bun run bench:mitata --filter parse   # mitata's built-in name filter (regex)
 *
 * To establish a baseline and check whether a change actually helped:
 *   bun run bench:mitata > /tmp/before.txt
 *   ...make a change...
 *   bun run bench:mitata > /tmp/after.txt
 *   diff /tmp/before.txt /tmp/after.txt
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { bench, do_not_optimize, group, run } from "mitata";
import { generateBundle } from "../src/bundle";
import { setQuiet } from "../src/logger";
import { hashSource, ParseCache } from "../src/parse-cache";
import { getParserStack, loadParserStack } from "../src/parser-stack";
import { buildComponentApiDocument } from "../src/writer/document-model";
import { renderJsonDocument } from "../src/writer/writer-json";
import { renderMarkdownDocument } from "../src/writer/writer-markdown";
import { writeTsDefinition } from "../src/writer/writer-ts-definitions-core";

/**
 * A synthetic component shaped nothing like carbon's real components: wide
 * union types and nested generics repeated across many props/events, to
 * stress type-printing cost that a realistic fixture wouldn't surface.
 */
function buildPathologicalComponent(propCount: number, eventCount: number): string {
  const literalUnion = Array.from({ length: 12 }, (_, i) => `"variant-${i}"`).join(" | ");
  const complexType = `${literalUnion} | Array<{ id: string; value: number | string; meta?: Record<string, unknown> }> | null`;

  const props = Array.from(
    { length: propCount },
    (_, i) =>
      `  /**\n   * Synthetic prop ${i} for pathological-shape benchmarking.\n   * @type {${complexType}}\n   */\n  export let prop${i} = null;`,
  ).join("\n\n");

  const events = Array.from(
    { length: eventCount },
    (_, i) => ` * @event {{ index: number; detail: ${complexType} }} synthetic-event-${i}`,
  ).join("\n");

  return `<script>\n/**\n${events}\n */\n\n${props}\n</script>\n\n<div />\n`;
}

const FIXTURE_DIR = join(import.meta.dir, "..", "tests", "e2e", "carbon", "src");
const ENTRY = join(FIXTURE_DIR, "index.js");

// One small/medium/large real component, picked by line count, so parse and
// write costs are measured against realistic (not synthetic) source shapes.
const SAMPLES = {
  small: { file: join(FIXTURE_DIR, "Grid", "Row.svelte"), moduleName: "Row" },
  medium: { file: join(FIXTURE_DIR, "NumberInput", "NumberInput.svelte"), moduleName: "NumberInput" },
  large: { file: join(FIXTURE_DIR, "DataTable", "DataTable.svelte"), moduleName: "DataTable" },
} as const;

await loadParserStack();
const { ComponentParser } = getParserStack();
const sources = Object.fromEntries(
  Object.entries(SAMPLES).map(([size, sample]) => [size, readFileSync(sample.file, "utf-8")]),
) as Record<keyof typeof SAMPLES, string>;

const pathologicalFilePath = "pathological.svelte";
const pathologicalSource = buildPathologicalComponent(200, 20);

group("parse: single component", () => {
  for (const [size, sample] of Object.entries(SAMPLES)) {
    bench(`parseSvelteComponent (${size}, ${sample.moduleName})`, () => {
      const parser = new ComponentParser();
      do_not_optimize(
        parser.parseSvelteComponent(sources[size as keyof typeof SAMPLES], {
          moduleName: sample.moduleName,
          filePath: sample.file,
        }),
      );
    });
  }

  bench("parseSvelteComponent (pathological, 200 wide-union props)", () => {
    const parser = new ComponentParser();
    do_not_optimize(
      parser.parseSvelteComponent(pathologicalSource, {
        moduleName: "Pathological",
        filePath: pathologicalFilePath,
      }),
    );
  });
});

// Run the real pipeline once (quietly) to source real ComponentDocApi
// objects for the write/document-model benchmarks below, instead of
// hand-rolling fixtures that could drift from what parsing actually produces.
setQuiet(true);
const pipelineResult = await generateBundle(ENTRY, true, { cache: false });
setQuiet(false);

const document = buildComponentApiDocument(pipelineResult.allComponentsForTypes);
const docsBySize = Object.fromEntries(
  Object.entries(SAMPLES).map(([size, sample]) => [
    size,
    document.components.find((component) => component.moduleName === sample.moduleName),
  ]),
);

// Parsed standalone (not through generateBundle, which resolves against the
// carbon fixture's file tree): the pathological component only needs its own
// parse result to reach writeTsDefinition.
const pathologicalParsed = new ComponentParser().parseSvelteComponent(pathologicalSource, {
  moduleName: "Pathological",
  filePath: pathologicalFilePath,
});
const pathologicalDoc = buildComponentApiDocument(new Map([[pathologicalFilePath, pathologicalParsed]])).components[0];

group("write: types (single component)", () => {
  for (const [size, doc] of Object.entries(docsBySize)) {
    if (!doc) continue;
    bench(`writeTsDefinition (${size}, ${doc.moduleName})`, () => {
      do_not_optimize(writeTsDefinition(doc));
    });
  }

  if (pathologicalDoc) {
    bench("writeTsDefinition (pathological, 200 wide-union props)", () => {
      do_not_optimize(writeTsDefinition(pathologicalDoc));
    });
  }
});

group("write: document model", () => {
  bench(`buildComponentApiDocument (${document.components.length} components)`, () => {
    // buildComponentApiDocument caches by `components` Map identity; wrap the
    // same entries in a fresh Map each iteration so this measures the real
    // sort/strip cost instead of a cache hit after the first sample.
    const fresh = new Map(pipelineResult.allComponentsForTypes);
    do_not_optimize(buildComponentApiDocument(fresh));
  });
});

// renderJsonDocument/renderMarkdownDocument are the pure, I/O-free cores the
// registered "json"/"markdown" writers call after resolving output paths, so
// this measures the same render cost as a real run without touching disk.
const inputDir = dirname(ENTRY);
group("write: json/markdown (full fixture)", () => {
  bench(`renderJsonDocument (${document.components.length} components)`, () => {
    do_not_optimize(
      renderJsonDocument(pipelineResult.components, { inputDir, entryExports: pipelineResult.entryExports }),
    );
  });

  bench(`renderMarkdownDocument (${document.components.length} components)`, () => {
    do_not_optimize(renderMarkdownDocument(pipelineResult.components, { entryExports: pipelineResult.entryExports }));
  });
});

// hashSource runs once per file on every invocation (parse-cache hit or not),
// so its cost scales with fixture size regardless of cache state.
group("cache: hashSource", () => {
  for (const [size, source] of Object.entries(sources)) {
    bench(`hashSource (${size})`, () => {
      do_not_optimize(hashSource(source));
    });
  }
});

group("cache: ParseCache.get", () => {
  const warmCache = new ParseCache(join(FIXTURE_DIR, ".bench-mitata-cache.json"));
  const hitPath = SAMPLES.medium.file;
  const hitHash = hashSource(sources.medium);
  warmCache.set(hitPath, hitHash, pipelineResult.allComponentsForTypes.get(hitPath) ?? pathologicalParsed);

  bench("get (hit)", () => {
    do_not_optimize(warmCache.get(hitPath, hitHash));
  });

  bench("get (miss, unknown path)", () => {
    do_not_optimize(warmCache.get("/nonexistent/path.svelte", hitHash));
  });

  bench("get (miss, stale hash)", () => {
    do_not_optimize(warmCache.get(hitPath, "stale-hash"));
  });
});

group("pipeline: full carbon fixture", () => {
  bench(`generateBundle (${document.components.length} components, no cache)`, async () => {
    do_not_optimize(await generateBundle(ENTRY, true, { cache: false }));
  });
});

await run();
