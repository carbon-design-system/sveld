/**
 * Statistically rigorous microbenchmarks for sveld's hot paths, using ostia
 * (warmup, batching, outlier-aware stats) rather than the wall-clock medians
 * in `scripts/bench.ts` (which times the full pipeline / stages of one real
 * invocation instead of many statistically-sampled iterations).
 *
 * Covers, from a real fixture (the carbon e2e fixture, ~160 components):
 *   - parse: parseSvelteComponent on a small/medium/large real component
 *     (legacy `export let` + JSDoc, which is all carbon uses)
 *   - parse: parseSvelteComponent on synthetic small/medium/large Svelte 5
 *     components (`lang="ts"`, `generics`, typed `$props()` destructuring,
 *     `$bindable()`, snippet and callback props) — carbon has no runes or
 *     TypeScript components, so without these the runes/TS parser paths
 *     (`src/parser/runes-props.ts`, `type-resolution.ts`, `generics.ts`)
 *     would never be measured
 *   - parse: parseSvelteComponent on a synthetic pathological component
 *     (200 props with wide union/generic JSDoc types) — realistic samples
 *     alone can't show worst-case type-resolution cost
 *   - parse: template parser only (`src/template-parse/` `parse()`) on the
 *     same samples plus a markup-heavy synthetic (many elements, nested
 *     blocks, a snippet)
 *   - write: writeTsDefinition on the parsed doc for those same components,
 *     including the runes/TS and pathological ones
 *   - write: renderJsonDocument / renderMarkdownDocument /
 *     renderCustomElementsManifest / renderLlmsDocuments (the pure, I/O-free
 *     cores the real writers call) over all 160
 *   - document model: buildComponentApiDocument's sort/strip over all 160
 *   - watch: buildReverseDeps over all 160 and expandAffected on the result
 *   - cache: hashSource (sha256, paid once per file every run) and
 *     ParseCache.get over every carbon component (hit vs. miss)
 *   - pipeline: generateBundle end-to-end, no cache, in both entry-barrel
 *     mode and `--glob` directory-walk mode
 *
 * Deliberately out of scope: Writer's actual disk I/O (fs write cost isn't
 * sveld logic) and the on-disk cache file read/write (`ParseCache.save`,
 * `readCacheFile`) — both are one-shot per run, not per-file hot paths.
 * `sveld check` (`diffApiDocuments`) is likewise one-shot and cheap.
 *
 * Usage:
 *   bun run bench:ostia
 *   bun run bench:ostia -- --budget 1000 --min-samples 50
 *   bun run bench:ostia -- --filter parse   # ostia's name filter (regex, substring match)
 *
 * To establish a baseline and check whether a change actually helped:
 *   bun run bench:ostia > /tmp/before.txt
 *   ...make a change...
 *   bun run bench:ostia > /tmp/after.txt
 *   diff /tmp/before.txt /tmp/after.txt
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { group, task } from "ostia";
import { collectComponents, generateBundle } from "../src/bundle";
import { buildReverseDeps, expandAffected } from "../src/dependency-graph";
import { setQuiet } from "../src/logger";
import { hashSource, ParseCache } from "../src/parse-cache";
import { getParserStack, loadParserStack } from "../src/parser-stack";
import { parse as parseTemplate } from "../src/svelte-template-parse";
import { buildComponentApiDocument } from "../src/writer/document-model";
import { renderCustomElementsManifest } from "../src/writer/writer-custom-elements";
import { renderJsonDocument } from "../src/writer/writer-json";
import { renderLlmsDocuments } from "../src/writer/writer-llms";
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

/**
 * A Svelte 5 component in the shape modern TypeScript libraries ship:
 * `lang="ts"` with a `generics` attribute, an inline `Props` type, and a
 * typed `$props()` destructure mixing plain props, `$bindable()`, callback
 * props, and a `Snippet`. Every `propCount` props cycle through those kinds
 * so each runes code path gets exercised proportionally. JSDoc on each
 * property so the runes comment-association path runs too.
 */
function buildRunesTsComponent(propCount: number): string {
  const typeMembers: string[] = [];
  const destructured: string[] = [];

  for (let i = 0; i < propCount; i++) {
    const doc = `    /** Synthetic runes prop ${i}. */`;
    switch (i % 4) {
      case 0:
        typeMembers.push(`${doc}\n    size${i}?: "sm" | "md" | "lg" | number;`);
        destructured.push(`    size${i} = "md",`);
        break;
      case 1:
        typeMembers.push(`${doc}\n    value${i}?: Item | null;`);
        destructured.push(`    value${i} = $bindable(null),`);
        break;
      case 2:
        typeMembers.push(
          `${doc}\n    onchange${i}?: (item: Item, meta: { index: number; source: "user" | "api" }) => void;`,
        );
        destructured.push(`    onchange${i},`);
        break;
      default:
        typeMembers.push(`${doc}\n    cell${i}?: Snippet<[item: Item, index: number]>;`);
        destructured.push(`    cell${i},`);
        break;
    }
  }

  return `<script lang="ts" generics="Item extends { id: string | number } = { id: string }">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type Props = HTMLAttributes<HTMLDivElement> & {
    /** Rows to render. */
    items: Item[];
    /** Row renderer. */
    row: Snippet<[item: Item]>;
${typeMembers.join("\n")}
  };

  let {
    items,
    row,
${destructured.join("\n")}
    ...rest
  }: Props = $props();

  let count = $derived(items.length);
</script>

<div {...rest} data-count={count}>
  {#each items as item (item.id)}
    {@render row(item)}
  {/each}
</div>
`;
}

/**
 * Many sibling elements with directives, nested `{#if}` blocks, and a
 * snippet. Stresses the template parser. `buildPathologicalComponent` above
 * stresses JSDoc/type printing, which this parser never touches.
 */
function buildTemplateHeavyComponent(elementCount: number, nestingDepth: number): string {
  const items = Array.from(
    { length: elementCount },
    (_, i) =>
      `    <button class:active={i === ${i}} on:click|preventDefault={() => handleClick(${i})} bind:this={refs[${i}]} data-index="${i}" aria-label="Item {${i}}">Item {${i}}</button>`,
  ).join("\n");

  const opens = Array.from({ length: nestingDepth }, (_, i) => `{#if depth${i} ?? true}`).join("");
  const closes = Array.from({ length: nestingDepth }, () => "{/if}").join("");

  return `<script lang="ts">
  export let items: Array<{ id: string; label: string; visible: boolean }> = [];
  export let refs: HTMLElement[] = [];
  function handleClick(i: number) { console.log(i); }
</script>

${opens}
{#each items as item, i (item.id)}
  <div class:even={i % 2 === 0}>
    {#if item.visible}
      {#snippet row(entry: typeof item)}
        <span>{entry.label}</span>
      {/snippet}
      {@render row(item)}
    {:else}
      <em>hidden</em>
    {/if}
  </div>
{/each}
${items}
${closes}
`;
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

// Prop counts chosen so the runes samples roughly track the legacy samples'
// line counts (Row ~30 lines, NumberInput ~250, DataTable ~600+).
const RUNES_SAMPLES = {
  small: { propCount: 4, moduleName: "RunesSmall" },
  medium: { propCount: 30, moduleName: "RunesMedium" },
  large: { propCount: 120, moduleName: "RunesLarge" },
} as const;

await loadParserStack();
const { ComponentParser } = getParserStack();
const sources = Object.fromEntries(
  Object.entries(SAMPLES).map(([size, sample]) => [size, readFileSync(sample.file, "utf-8")]),
) as Record<keyof typeof SAMPLES, string>;

const runesSources = Object.fromEntries(
  Object.entries(RUNES_SAMPLES).map(([size, sample]) => [size, buildRunesTsComponent(sample.propCount)]),
) as Record<keyof typeof RUNES_SAMPLES, string>;
const runesFilePath = (size: string) => `${size}.runes.svelte`;

const pathologicalFilePath = "pathological.svelte";
const pathologicalSource = buildPathologicalComponent(200, 20);

group("parse: single component (legacy, carbon)", () => {
  for (const [size, sample] of Object.entries(SAMPLES)) {
    task(`parseSvelteComponent (${size}, ${sample.moduleName})`, () => {
      const parser = new ComponentParser();
      return parser.parseSvelteComponent(sources[size as keyof typeof SAMPLES], {
        moduleName: sample.moduleName,
        filePath: sample.file,
      });
    });
  }

  task("parseSvelteComponent (pathological, 200 wide-union props)", () => {
    const parser = new ComponentParser();
    return parser.parseSvelteComponent(pathologicalSource, {
      moduleName: "Pathological",
      filePath: pathologicalFilePath,
    });
  });
});

group("parse: single component (runes + TypeScript, synthetic)", () => {
  for (const [size, sample] of Object.entries(RUNES_SAMPLES)) {
    task(`parseSvelteComponent (${size}, ${sample.propCount} $props)`, () => {
      const parser = new ComponentParser();
      return parser.parseSvelteComponent(runesSources[size as keyof typeof RUNES_SAMPLES], {
        moduleName: sample.moduleName,
        filePath: runesFilePath(size),
      });
    });
  }
});

/**
 * `src/template-parse/` `parse()` alone. No JSDoc extraction, prop
 * resolution, or type-text work. See the groups above for the full pipeline.
 */
const templateHeavySource = buildTemplateHeavyComponent(150, 8);

group("parse: template parser only (src/template-parse/)", () => {
  for (const [size, sample] of Object.entries(SAMPLES)) {
    task(`parse [template-parse] (${size}, ${sample.moduleName})`, () =>
      parseTemplate(sources[size as keyof typeof SAMPLES]),
    );
  }

  task("parse [template-parse] (runes large, lang=ts)", () => parseTemplate(runesSources.large));

  task("parse [template-parse] (markup-heavy, 150 elements x 8 nested blocks)", () =>
    parseTemplate(templateHeavySource),
  );
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
// carbon fixture's file tree): the synthetic components only need their own
// parse result to reach writeTsDefinition.
const pathologicalParsed = new ComponentParser().parseSvelteComponent(pathologicalSource, {
  moduleName: "Pathological",
  filePath: pathologicalFilePath,
});
const pathologicalDoc = buildComponentApiDocument(new Map([[pathologicalFilePath, pathologicalParsed]])).components[0];

const runesDocsBySize = Object.fromEntries(
  Object.entries(RUNES_SAMPLES).map(([size, sample]) => {
    const filePath = runesFilePath(size);
    const parsed = new ComponentParser().parseSvelteComponent(runesSources[size as keyof typeof RUNES_SAMPLES], {
      moduleName: sample.moduleName,
      filePath,
    });
    return [size, buildComponentApiDocument(new Map([[filePath, parsed]])).components[0]];
  }),
);

group("write: types (single component)", () => {
  for (const [size, doc] of Object.entries(docsBySize)) {
    if (!doc) continue;
    task(`writeTsDefinition (${size}, ${doc.moduleName})`, () => writeTsDefinition(doc));
  }

  for (const [size, doc] of Object.entries(runesDocsBySize)) {
    if (!doc) continue;
    task(
      `writeTsDefinition (runes ${size}, ${RUNES_SAMPLES[size as keyof typeof RUNES_SAMPLES].propCount} $props)`,
      () => writeTsDefinition(doc),
    );
  }

  if (pathologicalDoc) {
    task("writeTsDefinition (pathological, 200 wide-union props)", () => writeTsDefinition(pathologicalDoc));
  }
});

group("write: document model", () => {
  task(`buildComponentApiDocument (${document.components.length} components)`, () => {
    // buildComponentApiDocument caches by `components` Map identity; wrap the
    // same entries in a fresh Map each iteration so this measures the real
    // sort/strip cost instead of a cache hit after the first sample.
    const fresh = new Map(pipelineResult.allComponentsForTypes);
    return buildComponentApiDocument(fresh);
  });
});

// These render* functions are the pure, I/O-free cores the registered
// writers call after resolving output paths, so this measures the same
// render cost as a real run without touching disk. (renderLlmsDocuments does
// read package.json once per call for its title/summary fallback, exactly as
// a real run does; `title`/`summary` are passed so only the read remains.)
const inputDir = dirname(ENTRY);
group("write: json/markdown/custom-elements/llms (full fixture)", () => {
  task(`renderJsonDocument (${document.components.length} components)`, () =>
    renderJsonDocument(pipelineResult.components, { inputDir, entryExports: pipelineResult.entryExports }),
  );

  task(`renderMarkdownDocument (${document.components.length} components)`, () =>
    renderMarkdownDocument(pipelineResult.components, { entryExports: pipelineResult.entryExports }),
  );

  task(`renderCustomElementsManifest (${document.components.length} components)`, () =>
    renderCustomElementsManifest(pipelineResult.components, { inputDir }),
  );

  task(`renderLlmsDocuments (${document.components.length} components)`, () =>
    renderLlmsDocuments(pipelineResult.components, {
      title: "carbon-components-svelte",
      summary: "Bench fixture",
      entryExports: pipelineResult.entryExports,
    }),
  );
});

// Watch mode rebuilds the reverse-dependency map after every parse and
// expands each changed file through it; both scale with fixture size.
const { resolveComponentFilePath } = collectComponents(ENTRY, false);
const reverseDeps = buildReverseDeps(pipelineResult.allComponentsForTypes, resolveComponentFilePath);
const allComponentPaths = [...pipelineResult.allComponentsForTypes.keys()];

group("watch: dependency graph", () => {
  task(`buildReverseDeps (${document.components.length} components)`, () =>
    buildReverseDeps(pipelineResult.allComponentsForTypes, resolveComponentFilePath),
  );

  task(`expandAffected (all ${allComponentPaths.length} paths changed)`, () =>
    expandAffected(allComponentPaths, reverseDeps),
  );
});

// hashSource runs once per file on every invocation (parse-cache hit or not),
// so its cost scales with fixture size regardless of cache state.
group("cache: hashSource", () => {
  for (const [size, source] of Object.entries(sources)) {
    task(`hashSource (${size})`, () => hashSource(source));
  }
});

// A single ParseCache.get is a Map lookup (single-digit ns, below ostia's
// timer resolution), so measure one full run's worth of lookups instead:
// every carbon component, first all hits, then all misses.
// allComponentsForTypes is keyed by the entry-relative filePath; the cache
// (like a real run) is keyed by the resolved absolute path.
const carbonHashes = new Map(
  allComponentPaths.map((path) => {
    const resolved = resolveComponentFilePath(path);
    return [resolved, hashSource(readFileSync(resolved, "utf-8"))];
  }),
);
const warmCache = new ParseCache(join(FIXTURE_DIR, ".bench-ostia-cache.json"));
for (const [path, api] of pipelineResult.allComponentsForTypes) {
  const resolved = resolveComponentFilePath(path);
  const hash = carbonHashes.get(resolved);
  if (hash !== undefined) warmCache.set(resolved, hash, api);
}

group("cache: ParseCache.get (full fixture)", () => {
  task(`get x${allComponentPaths.length} (all hits)`, () => {
    let hits = 0;
    for (const [path, hash] of carbonHashes) {
      if (warmCache.get(path, hash) !== undefined) hits++;
    }
    return hits;
  });

  task(`get x${allComponentPaths.length} (all misses, stale hash)`, () => {
    let misses = 0;
    for (const path of carbonHashes.keys()) {
      if (warmCache.get(path, "stale-hash") === undefined) misses++;
    }
    return misses;
  });
});

group("pipeline: full carbon fixture", () => {
  task(`generateBundle (${document.components.length} components, entry barrel, no cache)`, () =>
    generateBundle(ENTRY, true, { cache: false }),
  );

  // Directory-walk discovery (`sveld --glob <dir>`): exercises
  // globComponentSources / fs-listing instead of the entry-barrel resolver.
  task(`generateBundle (${document.components.length} components, glob dir, no cache)`, () =>
    generateBundle(FIXTURE_DIR, true, { cache: false }),
  );
});
