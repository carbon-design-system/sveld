/**
 * Statistically rigorous microbenchmarks for sveld's hot paths, using mitata
 * (warmup, batching, outlier-aware percentiles) rather than the wall-clock
 * medians in `scripts/bench.ts` (which times the full pipeline / stages of
 * one real invocation instead of many statistically-sampled iterations).
 *
 * Covers, from a real fixture (the carbon e2e fixture, ~160 components):
 *   - parse: parseSvelteComponent on a small/medium/large real component
 *   - write: writeTsDefinition on the parsed doc for those same components
 *   - document model: buildComponentApiDocument's sort/strip over all 160
 *   - pipeline: generateBundle end-to-end, no cache
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
import { join } from "node:path";
import { bench, do_not_optimize, group, run } from "mitata";
import { generateBundle } from "../src/bundle";
import { setQuiet } from "../src/logger";
import { getParserStack, loadParserStack } from "../src/parser-stack";
import { buildComponentApiDocument } from "../src/writer/document-model";
import { writeTsDefinition } from "../src/writer/writer-ts-definitions-core";

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

group("write: types (single component)", () => {
  for (const [size, doc] of Object.entries(docsBySize)) {
    if (!doc) continue;
    bench(`writeTsDefinition (${size}, ${doc.moduleName})`, () => {
      do_not_optimize(writeTsDefinition(doc));
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

group("pipeline: full carbon fixture", () => {
  bench(`generateBundle (${document.components.length} components, no cache)`, async () => {
    do_not_optimize(await generateBundle(ENTRY, true, { cache: false }));
  });
});

await run();
