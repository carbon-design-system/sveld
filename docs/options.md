# Options

sveld runs from the CLI, as a Vite/Rollup plugin, or from Node with `sveld()`. All three take the same options.

- [Option reference](#option-reference)
- [`typesOptions`](#typesoptions)
- [`jsonOptions`](#jsonoptions)
- [`markdownOptions`](#markdownoptions)
- [Parse cache](#parse-cache)
- [CLI](#cli)
- [Config file](#config-file)
- [Vite plugin](#vite-plugin)
- [Node API](#node-api)
- [Browser](#browser)

## Option reference

With no options, sveld generates TypeScript definitions only, for the entry named by `package.json#svelte`.

| Option | Type | Default | CLI flag | Description |
| :- | :- | :- | :- | :- |
| `entry` | `string` | `package.json#svelte` | `--entry` | Entry point to uncompiled Svelte source. |
| `glob` | `boolean` | `false` | `--glob` | Also write a `.d.ts` for every `*.svelte` file under the entry's directory, including ones the entry doesn't export. See [CLI](#cli) for a directory entry. |
| `documentExports` | `boolean` | `false` | | Document the barrel's non-component exports. See [Entry exports](output.md#entry-exports). |
| `types` | `boolean` | `true` | `--types` | Write `.d.ts` files. |
| `typesOptions` | `object` | | | See [`typesOptions`](#typesoptions). |
| `json` | `boolean` | `false` | `--json` | Write `COMPONENT_API.json`. |
| `jsonOptions` | `object` | | | See [`jsonOptions`](#jsonoptions). |
| `markdown` | `boolean` | `false` | `--markdown` | Write `COMPONENT_INDEX.md`. |
| `markdownOptions` | `object` | | | See [`markdownOptions`](#markdownoptions). |
| `failFast` | `boolean` | `false` | `--fail-fast` | Stop at the first component that fails to parse. Otherwise the failure is reported and the other components' output is still written. |
| `cache` | `boolean \| string` | `true` | `--cache[=<path>]` | Persistent parse cache. See [Parse cache](#parse-cache). |
| `checkExamples` | `boolean \| "syntax"` | `false` | `--check-examples[=syntax]` | Compile-check `@example` blocks. See [CI](ci.md#checking-example-blocks). |
| `reportDiagnostics` | `boolean` | `false` | `--report-diagnostics` | Print diagnostics. See [CI](ci.md#diagnostics). |
| `strict` | `boolean \| "errors"` | `false` | `--strict[=errors]` | Exit `4` when diagnostics exist. Implies `reportDiagnostics`. |
| `diagnostics.ignore` | `Array<{ code?, component?, name? }>` | | | Mark matching diagnostics ignored. See [Ignoring diagnostics](ci.md#ignoring-diagnostics). |
| `check` | `boolean \| string` | `false` | `--check[=<path>]` | Diff the API against a committed snapshot. See [`--check`](ci.md#api-drift-checks---check). |
| `checkLevel` | `"major" \| "minor" \| "patch"` | `"major"` | `--check-level` | Minimum bump that fails `--check`. |
| `format` | `"text" \| "json"` | `"text"` | `--format` | Format of the `--check` report and diagnostics summary. |
| `stdout` | `boolean` | `false` | `--stdout` | Print the JSON or Markdown document instead of writing files. See [CLI](#cli). |
| `quiet` | `boolean` | `false` | `-q`, `--quiet` | Hide `created`/`unchanged` progress lines. |
| `config` | `boolean \| string` | `false` | | Plugin only: load `sveld.config.*`. See [Vite plugin](#vite-plugin). |
| `watch` | `boolean` | `false` | | Plugin only: regenerate during `vite dev`. See [Vite plugin](#vite-plugin). |

The CLI also takes `--config <path>`, `-h`/`--help`, and `-v`/`--version`.

## `typesOptions`

| Key | Type | Default | Description |
| :- | :- | :- | :- |
| `outDir` | `string` | `"types"` | Output directory, relative to the project root. |
| `format` | `"class" \| "component"` | `"class"` | `.d.ts` shape. CLI: `--types-format`. See [Formats](output.md#formats). |
| `preamble` | `string` | `""` | Text prepended to `index.d.ts`. |
| `indexTypes` | `boolean` | `false` | Also re-export each component's types from `index.d.ts`. CLI: `--types-index-types`. |
| `transform` | `(text, context) => string \| Promise<string>` | | Rewrite each file's text before it's written. |

### `preamble`

Prepends raw text to `index.d.ts`, for example a license header. Per-component files are unchanged.

```js
sveld({
  typesOptions: {
    preamble: "// Copyright (c) 2026 Acme Inc. All rights reserved.\n\n",
  },
});
```

```ts
// types/index.d.ts
// Copyright (c) 2026 Acme Inc. All rights reserved.

export { default as Button } from "./Button.svelte";
```

### `indexTypes`

By default `index.d.ts` only re-exports components, so a consumer who wants `ButtonProps` has to deep-import `my-lib/types/Button.svelte`. With `indexTypes: true`, the barrel re-exports each component's `Props` type, plus its `Exports` type under `format: "component"`:

```ts
// types/index.d.ts
export { default as Button } from "./Button.svelte";

export type { ButtonProps } from "./Button.svelte";
```

```ts
import type { ButtonProps } from "my-lib";
```

### `transform`

An escape hatch for edits no other option covers: adding a `/// <reference>` directive, rewriting an import specifier, stripping a banner. It runs on each generated file's text right before it's written. `context` has `kind` (`"component"` or `"index"`), `filePath` relative to `outDir` (`"Button.svelte.d.ts"`, `"index.d.ts"`), and for components the parsed `component`.

```js
sveld({
  typesOptions: {
    transform: (text, context) => {
      if (context.kind !== "component") return text;
      return `/// <reference types="svelte" />\n${text}`;
    },
  },
});
```

`transform` runs after the [parse cache](#parse-cache), so it applies on every run, including when the `.d.ts` text came from the cache. A transform that throws, or returns something other than a string, fails the run with an error naming the file. There is no CLI flag; set it in a config file or `sveld()`.

## `jsonOptions`

| Key | Type | Default | Description |
| :- | :- | :- | :- |
| `outFile` | `string` | `"COMPONENT_API.json"` | Path of the combined document, relative to the project root. Ignored when `outDir` is set. |
| `outDir` | `string` | | Write one `<Name>.api.json` per component into this directory instead. |
| `source` | `boolean` | `true` | Set `false` to omit every `source`/`componentCommentSource` range, which shrinks the file noticeably for large libraries. |

`source: false` doesn't affect entry exports' `source` field, which is the declaring module's path.

## `markdownOptions`

| Key | Type | Default | Description |
| :- | :- | :- | :- |
| `outFile` | `string` | `"COMPONENT_INDEX.md"` | Path of the combined document. Ignored when `outDir` is set. |
| `outDir` | `string` | | Write one `<Name>.md` per component plus an index `README.md` (which holds the Exports section when `documentExports` is on). |
| `onAppend` | `(type, document, components) => void` | | Called for every heading, quote, paragraph, divider, and raw block written. |

`onAppend` receives the block `type`, the in-progress `MarkdownDocument`, and the component map. It fires for the index and every per-component file. Use it to add content, for example a summary under the title:

```js
import pkg from "./package.json" with { type: "json" };

sveld({
  markdown: true,
  markdownOptions: {
    onAppend: (type, document, components) => {
      if (type === "h1") {
        document.append("quote", `${components.size} components exported from ${pkg.name}@${pkg.version}.`);
      }
    },
  },
});
```

```md
# Component Index

> 1 components exported from my-lib@1.0.0.
```

## Parse cache

sveld caches each component's parse on disk and reuses it while the source is unchanged. Entries are keyed on a hash of the source, not file times, so a cache restored in CI stays valid. Generated `.d.ts` text is cached too, keyed on the source and every `typesOptions` value that affects output.

The default location is `node_modules/.cache/sveld/parse-cache.json` in the project root (the nearest directory above the entry with a `package.json`). Pass a path to move it (relative paths resolve against the project root), or `false` to turn it off:

```sh
npx sveld --cache=.cache/sveld.json
npx sveld --cache=false
```

Values read from other files (an `@extendProps` target, an imported default or context key) are re-checked on every run, so editing those files never serves stale output. Upgrading sveld or Svelte clears the cache.

## CLI

```sh
npx sveld                     # .d.ts only
npx sveld --json --markdown   # plus COMPONENT_API.json and COMPONENT_INDEX.md
npx sveld --help              # every flag
```

- Flags are kebab-case. Unknown flags, camelCase spellings (`--checkExamples`), and positional arguments exit `1` with a suggestion when one is close: `sveld: unknown flag "--markdwon". Did you mean "--markdown"?`.
- `--entry`, `--config`, `--cache`, `--check`, and `--types-format` take a value as `--flag=value` or `--flag value`. If the next argument is another flag, it isn't taken as a value. Boolean flags never take the next argument.
- Progress lines (`created ...`, `unchanged ...`) go to `stderr`, keeping `stdout` for data. `--quiet` hides them but not errors, diagnostics, or the `--check` report.
- `--stdout` with exactly one of `--json` or `--markdown` prints that document instead of writing files, and skips `.d.ts` generation: `sveld --json --stdout | jq '.components[].moduleName'`. Combining it with `--types` or `--check`, or with neither or both of `--json`/`--markdown`, exits `1`.
- `--format=json` prints the `--check` report (to `stdout`) and the diagnostics summary (to `stderr`) as JSON. See [CI](ci.md#machine-readable-output).
- `--glob` with a directory as `--entry` documents every `.svelte` file under it in all outputs, with no barrel file. Each file name becomes the component's module name. With a file entry, `--glob` adds `.d.ts` files for unexported components, but JSON and Markdown still cover only the entry's exports.

If no entry is configured, the CLI uses `src/index.js` when it exists, with a note asking you to set `package.json#svelte` or `--entry`. Otherwise it exits `1`. An `--entry` or `package.json#svelte` path that doesn't exist also exits `1`. See [Exit codes](ci.md#exit-codes).

## Config file

The CLI and `sveld()` read `sveld.config.js`, `sveld.config.mjs`, or `sveld.config.ts` from the working directory. The Vite plugin only reads it with [`config`](#vite-plugin). Config files use ESM (`export default`); `defineConfig` adds types:

```js
// sveld.config.js
import { defineConfig } from "sveld";

export default defineConfig({
  glob: true,
  json: true,
  markdown: true,
  strict: true,
  check: "snapshots/COMPONENT_API.json",
});
```

`--config <path>` loads a different file (relative to the working directory) instead of discovering one. A missing path exits `1`. A file that fails to load, or doesn't default-export an object, fails with an error naming the file.

Precedence, highest first: CLI flags or `sveld()` options, then the config file, then `package.json#svelte` and defaults. Object options (`typesOptions`, `jsonOptions`, `markdownOptions`) merge one level deep, so `npx sveld --types-format=component` keeps `outDir` and `preamble` from the file. Arrays and functions are replaced, not merged.

An unknown key, top-level or nested, prints a warning with a "did you mean" suggestion when one is close. It isn't an error.

A `sveld.config.ts` is loaded with a plain `import()`, so the runtime must strip TypeScript itself: Bun, or Node 22.18+ / 23.6+. On older Node, use `.js` or `.mjs`.

## Vite plugin

```ts
// vite.config.ts
import { svelte } from "@sveltejs/vite-plugin-svelte";
import sveld from "sveld";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte(), sveld({ json: true })],
});
```

The plugin runs during `vite build`. It works in Rollup configs too.

- **`config`**: `true` loads `sveld.config.*` from the Vite root and merges it, with the plugin's own options winning; a string names the file. The plugin warns about keys only the CLI and `sveld()` act on: `reportDiagnostics`, `strict`, `check`, `checkLevel`, `stdout`, and `format`.
- **`watch`**: also run in `vite dev` and `vite build --watch`, regenerating output when a component, the entry barrel, a module a component reads from (a prop default, context key, or dispatch helper), or a non-`.svelte` `@extendProps` target changes. Only affected components are re-parsed, and regenerations never overlap.

## Node API

```js
import { sveld } from "sveld";

const { document, diagnostics, errors, check, exitCode } = await sveld({
  entry: "./src/index.js",
  json: true,
  jsonOptions: { outFile: "docs/src/COMPONENT_API.json" },
});
```

`sveld` is ESM-only; use `import` or dynamic `import()`. Without `entry`, it reads `package.json#svelte` and throws if no entry resolves.

`sveld()` resolves to a `SveldResult`:

| Field | Description |
| :- | :- |
| `document` | The component API document, the same object `json: true` writes. Always populated. See [Custom output](output.md#custom-output). |
| `diagnostics` | Every diagnostic from the run, whether or not they were printed. See [Diagnostics](ci.md#diagnostics). |
| `errors` | Components that failed to parse. |
| `check` | The `check` result, when `check` is set. |
| `exitCode` | The exit code the CLI would use (`0`-`4`, lowest applicable wins). `sveld()` never sets `process.exitCode` itself. |

```js
import { formatCheckReport, sveld } from "sveld";

const { check, exitCode } = await sveld({ json: true, check: true });

if (check) console.log(formatCheckReport(check));

process.exitCode = exitCode;
```

The package also exports `defineConfig`, `formatCheckReportJson`, `diffApiDocuments`, `runCheck`, `buildComponentApiDocument`, `ComponentParser`, `DIAGNOSTIC_CODES`, and their types.

## Browser

`sveld/browser` parses and renders a single component without Node built-ins, for in-browser playgrounds and REPLs. It bundles with Vite, esbuild, webpack, or Rollup without polyfills. It doesn't scan directories, read config files, or follow imports.

```ts
import {
  asNormalizedPath,
  buildComponentApiDocument,
  ComponentParser,
  finalizeWithoutCrossFileResolution,
  writeMarkdownCore,
  writeTsDefinition,
} from "sveld/browser";

const parser = new ComponentParser();
const moduleName = "Button";
const filePath = "Button.svelte";
const parsed = finalizeWithoutCrossFileResolution(parser.parseSvelteComponent(source, { moduleName, filePath }), {
  filePath,
});

// Writers expect `moduleName` and `filePath` on each component.
const component = { ...parsed, moduleName, filePath: asNormalizedPath(filePath) };
const components = new Map([[moduleName, component]]);

const jsonDoc = buildComponentApiDocument(components);
const markdown = writeMarkdownCore(components);
const dts = writeTsDefinition(jsonDoc.components[0]);
```

A single-file parse can't read imported files, so it misses a `setContext` key imported from another module, the value of a default that names an imported `const`, and events dispatched by an imported helper. `finalizeWithoutCrossFileResolution` records a [`sveld/cross-file-unresolved`](ci.md#diagnostic-codes) warning for each, naming the import. It returns a new object and leaves its input unchanged.

A `ComponentParser` can be reused for many components.

The [`playground/`](../playground) directory is a working example, deployed at [sveld.onrender.com](https://sveld.onrender.com).
