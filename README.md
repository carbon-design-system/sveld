# sveld

[![NPM][npm]][npm-url]
![npm downloads to date](https://img.shields.io/npm/dt/sveld?color=262626&style=for-the-badge)

`sveld` generates TypeScript definitions and component documentation (Markdown/JSON) for Svelte components. It statically analyzes props, events, slots, module exports, context, and `$$restProps`. Add types with [JSDoc](https://jsdoc.app/) when inference is not enough.

The goal is to get third-party Svelte libraries working with the Svelte Language Server and TypeScript with minimal effort from the author. Generated `.d.ts` files give you autocomplete in VS Code and other IDEs.

[Carbon Components Svelte](https://github.com/carbon-design-system/carbon-components-svelte) uses this library to auto-generate component types and API metadata.

`sveld` uses the Svelte 5 compiler to parse `.svelte` files. That single parse path powers docgen and TypeScript output for Svelte 3, Svelte 4, and Svelte 5 without runes (`export let`, `<slot>`, `$$restProps`, …). It also covers Svelte 5 Runes (`$props()`, `$bindable()`, `{@render ...}`, callback props such as `onclick`, …).

For `lang="ts"` components, `sveld` keeps source-level prop type annotations when it can, instead of forcing JSDoc. That covers legacy `export let` props, typed `$props()` destructuring, typed whole-object `$props()` captures, local `interface`/`type` declarations, and imported type references in emitted `.d.ts` files.

Generated `.d.ts` files extend `SvelteComponentTyped` from `svelte`, so TypeScript and the Svelte Language Server work whether consumers use Svelte 3, Svelte 4, or Svelte 5.

## When to use sveld

SvelteKit's library tooling (`svelte-package`) and `svelte2tsx` already emit `.d.ts` files for SvelteKit-based projects, so start there if that's your setup. `sveld` targets JS-first Svelte libraries: components authored in plain JavaScript with JSDoc rather than `lang="ts"`, where you still want full editor types without adopting TypeScript. It also covers cases `svelte-package` doesn't: generating JSON and Markdown component docs from the same source as the types, checking for API drift between releases (`--check`), and deriving richer types from JSDoc tags (`@typedef`, `@callback`, `@slot`, context types) than plain type inference produces.

---

From a Svelte component, `sveld` can infer basic prop types and emit definitions the [Svelte Language Server](https://github.com/sveltejs/language-tools) understands:

**Button.svelte**

```svelte
<script>
  export let type = "button";
  export let primary = false;
</script>

<button {...$$restProps} {type} class:primary on:click>
  <slot>Click me</slot>
</button>
```

The following generated `.d.ts` extends `SvelteComponentTyped`:

**Button.svelte.d.ts**

```ts
import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * @default "button"
   */
  type?: string;

  /**
   * @default false
   */
  primary?: boolean;

  [key: `data-${string}`]: unknown;
};

export type ButtonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  { click: WindowEventMap["click"] },
  { default: Record<string, never> }
> {}
```

`sveld` adds the `[key: \`data-${string}\`]: unknown;` index signature whenever `$$restProps` is spread onto an element, so callers can pass arbitrary `data-*` attributes.

Inference only gets you so far. Use [JSDoc](https://jsdoc.app/) to document prop, event, and slot types when you need more precision.

```js
/** @type {"button" | "submit" | "reset"} */
export let type = "button";

/**
 * Set to `true` to use the primary variant
 */
export let primary = false;
```

With JSDoc, the output looks like this:

```ts
import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * @default "button"
   */
  type?: "button" | "submit" | "reset";

  /**
   * Set to `true` to use the primary variant
   * @default false
   */
  primary?: boolean;
};

export type ButtonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  { click: WindowEventMap["click"] },
  { default: Record<string, never> }
> {}
```

---

## Table of Contents

- [When to use sveld](#when-to-use-sveld)
- [Approach](#approach)
- [Features](#features)
  - [Opt-in semantic resolution (`resolveTypes`)](#opt-in-semantic-resolution-resolvetypes)
  - [Persistent parse cache (`cache`)](#persistent-parse-cache-cache)
  - [Compile-checked `@example` blocks (`checkExamples`)](#compile-checked-example-blocks-checkexamples)
  - [Type inference diagnostics](#type-inference-diagnostics)
- [Requirements](#requirements)
- [Usage](#usage)
  - [Installation](#installation)
  - [Vite](#vite)
  - [CLI](#cli)
  - [CI: API-drift checks (`--check`)](#ci-api-drift-checks---check)
  - [Node.js](#nodejs)
  - [Config File](#config-file)
  - [Publishing to NPM](#publishing-to-npm)
- [Available Options](#available-options)
- [Documenting Entry Exports](#documenting-entry-exports)
- [JSON Output](#json-output)
- [API Reference](#api-reference)
  - [reactive](#reactive)
  - [binding](#binding)
  - [@type](#type)
  - [@default](#default)
  - [@typedef](#typedef)
  - [@callback](#callback)
  - [@slot / @snippet](#slot--snippet)
    - [Extra JSDoc tags before `@slot`](#extra-jsdoc-tags-before-slot)
    - [Svelte 5 Snippet Compatibility](#svelte-5-snippet-compatibility)
  - [@event](#event)
  - [@deprecated](#deprecated)
  - [Context API](#context-api)
  - [@restProps](#restprops)
  - [@extendProps](#extendprops)
  - [@template](#template)
  - [@generics](#generics)
  - [@component comments](#component-comments)
  - [Accessor Props](#accessor-props)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Approach

`sveld` uses the Svelte compiler to statically analyze exported components and emit docs for consumers.

It extracts:

- props
- slots
- forwarded events
- dispatched events
- context (setContext/getContext)
- `$$restProps`

When inference fails, props fall back to `any` rather than guessing wrong. Authors can tighten types with JSDoc. Comments are optional from the compiler's point of view, so plain JavaScript components still parse.

When both TypeScript syntax and JSDoc are present, `sveld` resolves prop types in this order:

1. explicit TypeScript annotation
2. explicit JSDoc annotation
3. initializer inference
4. `any`

`sveld` stays AST-only. It copies imported and local type text into generated `.d.ts` output but does not run project-wide semantic resolution with the TypeScript compiler. Opaque imported whole-object `$props()` types can therefore stay in declarations without being fully expanded into JSON metadata.

## Features

### Opt-in semantic resolution (`resolveTypes`)

Imported whole-object `$props()` types stay opaque in JSON by default (`"props": []`). Turn on `resolveTypes` when a docs site or prop table needs the individual fields.

```ts
await sveld({ json: true, resolveTypes: true });
```

```svelte
<script lang="ts">
  import type { Props } from "./types";

  let props: Props = $props();
</script>
```

Without `resolveTypes`, JSON lists no props. With it, each field shows up with `"typeSource": "typescript"`:

```jsonc
{
  "props": [
    { "name": "disabled", "type": "boolean", "isRequired": false, "typeSource": "typescript" },
    { "name": "href", "type": "string", "isRequired": true, "typeSource": "typescript" },
    { "name": "variant", "type": "\"primary\" | \"secondary\"", "isRequired": true, "typeSource": "typescript" }
  ]
}
```

**Performance.** Off by default. This is the only path that loads TypeScript. It needs `typescript` and a `tsconfig.json`, runs slower than the AST-only pipeline, and gets slower as your types grow. Use it only when you need expanded JSON. `.d.ts` output is unchanged.

### Persistent parse cache (`cache`)

By default, every component is re-parsed on every run. With `cache`, parsed output is written to disk and reused when the source file has not changed. That applies across runs, including CI on a fresh checkout.

```ts
await sveld({ json: true, cache: true });
```

`cache: true` writes to `node_modules/.cache/sveld/parse-cache.json`. Pass a string to use a different location, e.g. `cache: ".cache/sveld.json"`. Also available as `--cache` / `--cache=<path>` on the CLI.

If a component [`@extendProps`](#extendprops) / [`@extends`](#extendprops) another file, it is re-parsed when that dependency changes, same as in [`watch`](#available-options) mode. Bumping the `sveld` or Svelte version clears the cache.

### Compile-checked `@example` blocks (`checkExamples`)

`@example` blocks are just text. Rename a prop and the sample code can sit there broken for months. Set `checkExamples: true` to run plain TS/JS `@example` blocks through the TypeScript program. Broken examples show up as `example-compile-error` diagnostics.

```ts
await sveld({ json: true, checkExamples: true });
```

```svelte
<script>
  /**
   * Formats a value.
   * @param {string} value
   * @returns {string}
   * @example
   * ```js
   * formatValue("ok");
   * ```
   */
  export function formatValue(value) {
    return value;
  }
</script>
```

If `formatValue` is later renamed and the example is never updated, `checkExamples` reports it:

```
@example blocks that failed to compile (1):
  ./Component.svelte
    - Line 1: Cannot find name 'formatValue'.
```

Plain TS/JS only. Examples fenced as `svelte` or `html`, or bare markup like `<Button />`, are skipped. Checking those needs `svelte2tsx` or similar, and sveld stays AST-only.

The check is narrow on purpose. It catches renamed or removed symbols and wrong argument counts. It is not full type checking and never pulls in types sveld cannot see.

Needs `typescript` and a `tsconfig.json`, same as `resolveTypes`. Use `--strict` (or the `strict` option) to fail CI when an example breaks.

### Type inference diagnostics

`sveld` collects unresolved-type diagnostics on every run: props that fall back to `any`, context values typed as `any`, `@event` tags with no dispatch or callback, and (when `checkExamples` is enabled) `example-compile-error`. They are always returned from the programmatic `sveld()` API in `SveldResult.diagnostics`.

With `reportDiagnostics` or `strict`, the grouped summary looks like this:

```
sveld: 4 unresolved types found.

Props without inferred types (1):
  ./icons/Add.svelte
    - Prop "title" type could not be inferred; falling back to "any".

Context values typed as `any` (1):
  ./ThemeProvider.svelte
    - Context "theme" variable "themeStore" has no type annotation; defaulted to "any".

@event tags with no dispatch or callback (2):
  ./Modal.svelte
    - @event "open" has no matching dispatch or callback prop.
    - @event "close" has no matching dispatch or callback prop.
```

When `checkExamples` is also enabled, `@example` compile failures appear as a fourth group:

```
@example blocks that failed to compile (1):
  ./Component.svelte
    - Line 1: Cannot find name 'formatValue'.
```

By default, nothing is printed. Opt in when you are working on types or want CI output:

```ts
await sveld({ json: true, reportDiagnostics: true });
```

Use `strict: true` (or `--strict`) to exit with code `1` when diagnostics exist. `strict` implies `reportDiagnostics`, so CI always shows why the run failed.

```ts
await sveld({ json: true, strict: true });
```

CLI equivalent:

```sh
npx sveld --json --report-diagnostics
npx sveld --json --strict
```

`--check` is separate: it diffs `COMPONENT_API.json` for API drift and semver classification, not inference warnings.

## Requirements

- Node 22+. CI tests against Node 22 on Linux, Windows, and macOS; earlier LTS versions are not verified.
- `sveld` is ESM-only. `require("sveld")` does not work — use `import` or dynamic `import()`.
- `sveld` bundles its own Svelte 5 compiler to parse `.svelte` files. Parsing does not depend on the Svelte version installed in your project, so Svelte 3 and Svelte 4 codebases parse the same way Svelte 5 codebases do — there is no compiler version to match up.

## Usage

### Installation

Install `sveld` as a development dependency.

```sh
# npm
npm i -D sveld

# pnpm
pnpm i -D sveld

# Bun
bun i -D sveld

# Yarn
yarn add -D sveld
```

### Vite

Import and add `sveld` as a plugin to your `vite.config.ts`. The plugin only runs during `vite build`, unless `watch: true` is set, in which case it also regenerates output during `vite dev`.

```ts
// vite.config.ts
import { svelte } from "@sveltejs/vite-plugin-svelte";
import sveld from "sveld";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte(), sveld()],
});
```

Since Vite uses Rollup for production builds, the same plugin works in Rollup configs.

By default, `sveld` uses the `"svelte"` field from your `package.json` to determine the entry point. You can override this by specifying an explicit `entry` option:

```js
sveld({
  entry: "src/index.js",
});
```

When building the library, TypeScript definitions are emitted to the `types` folder by default.

Customize the output folder using the `typesOptions.outDir` option.
Use `typesOptions.printWidth` to control Prettier wrapping for generated `.d.ts` files. The default is `80`.

The following example emits the output to the `dist` folder:

```diff
sveld({
+  typesOptions: {
+    outDir: 'dist',
+    printWidth: 80
+  }
})
```

### CLI

The CLI uses the `"svelte"` field from your `package.json` as the entry point:

```sh
npx sveld
```

Generate documentation in JSON and/or Markdown formats using the following flags:

```sh
npx sveld --json --markdown
```

### CI: API-drift checks (`--check`)

`--check` diffs the parsed component API against a committed `COMPONENT_API.json` snapshot, assigns a semver bump to each change, and exits `1` when it finds a breaking change.

1. Generate and commit the snapshot once: `npx sveld --json`, then commit `COMPONENT_API.json`.
2. Add `npx sveld --check` to CI:

```sh
npx sveld --check
```

```
sveld --check: 2 API changes detected against "COMPONENT_API.json".
Suggested semver bump: major.

  Button
    [BREAKING] prop "target" added (required)
    [BREAKING] prop "href" removed
```

Removed props, events, or slots, and props that become required, are breaking (`major`). New optional props, new events, and widened union types are additive (`minor`). Changes to generics, `@restProps`, `@extends`, or context shapes are not classified further. If any of those changed, `--check` calls it breaking.

`--check` does not write the snapshot. Run `sveld --json` (or `sveld --json --check`) and commit the file when you want to update it. If there is no snapshot yet, `--check` prints a notice and exits `0`.

Use `--check=<path>` to diff against a snapshot at a custom location (defaults to `jsonOptions.outFile`, or `COMPONENT_API.json`).

### Node.js

You can also call `sveld` from Node.js. See [Requirements](#requirements) for supported Node versions and the ESM-only constraint.

If no `input` is specified, `sveld` infers the entry point based on the `package.json#svelte` field.

```js
import { sveld } from "sveld";
import pkg from "./package.json" with { type: "json" };

const { diagnostics } = await sveld({
  input: "./src/index.js",
  glob: true,
  markdown: true,
  markdownOptions: {
    onAppend: (type, document, components) => {
      if (type === "h1")
        document.append(
          "quote",
          `${components.size} components exported from ${pkg.name}@${pkg.version}.`,
        );
    },
  },
  json: true,
  jsonOptions: {
    outFile: "docs/src/COMPONENT_API.json",
  },
});
```

`diagnostics` is always populated; printing is opt-in via `reportDiagnostics` or `strict` (see [Type inference diagnostics](#type-inference-diagnostics)).

#### `jsonOptions.outDir`

With `json: true`, `sveld` writes `COMPONENT_API.json` at the project root. The file documents all components.

Use the `jsonOptions.outDir` option to specify the folder for individual JSON files to be emitted.

```js
sveld({
  json: true,
  jsonOptions: {
    // an individual JSON file will be generated for each component API
    // e.g. "docs/Button.api.json"
    outDir: "docs",
  },
});
```

### Config File

Put a `sveld.config.js`, `sveld.config.mjs`, or `sveld.config.ts` at your project root to set defaults for the CLI and the programmatic `sveld()` API.

Import `defineConfig` from `sveld` for typed options. Config files must use ESM syntax (`export default`).

```js
// sveld.config.js
import { defineConfig } from "sveld";

export default defineConfig({
  glob: true,
  json: true,
  markdown: true,
});
```

Later sources win when options overlap:

CLI flags > config file > `package.json#svelte` inference / defaults

With the config above, `npx sveld --json` keeps `glob` and `markdown` from the file. A CLI flag overrides the same key in the config.

A bad config (syntax error, throws at load time, or no default-export object) fails with an error that names the file.

### Publishing to NPM

TypeScript definitions land in the `types` folder by default. Point consumers at them with an `exports` map, and include that folder in `package.json` when you publish to npm.

```diff
{
  "svelte": "./src/index.js",
+ "exports": {
+   ".": {
+     "types": "./types/index.d.ts",
+     "svelte": "./src/index.js",
+     "default": "./lib/index.mjs"
+   }
+ },
  "main": "./lib/index.mjs",
  "files": [
    "src",
    "lib",
+   "types",
  ]
}
```

The `svelte` condition lets bundlers that understand it (Vite, Rollup, webpack via `svelte-loader`) resolve straight to source; `types` and `default` cover TypeScript and everything else. Keep the top-level `"svelte"` field too — older tooling that predates conditional exports still reads it directly.

## Available Options

### Plugin Options

- **`entry`** (string, optional): Specify the entry point to uncompiled Svelte source. If not provided, sveld uses the `"svelte"` field from `package.json`.
- **`glob`** (boolean, optional): Enable glob mode to analyze all `*.svelte` files.
- **`documentExports`** (boolean, optional): Include consts, functions, and types from the entry barrel in JSON (`exports`) and Markdown ("Exports"). Off by default. See [Documenting Entry Exports](#documenting-entry-exports).
- **`types`** (boolean, optional, default: `true`): Generate TypeScript definitions.
- **`typesOptions`** (object, optional): Options for TypeScript definition generation, including `outDir`, `preamble`, and `printWidth`.
- **`json`** (boolean, optional): Generate component documentation in JSON format.
- **`jsonOptions`** (object, optional): Options for JSON output.
- **`markdown`** (boolean, optional): Generate component documentation in Markdown format.
- **`markdownOptions`** (object, optional): Options for Markdown output.
- **`watch`** (boolean, optional, default: `false`): Regenerate output incrementally when `.svelte` source changes during `vite dev` / `vite build --watch`. Only the changed component and the components that depend on it via [`@extendProps`](#extendprops) / `@extends` are re-parsed, rather than rebuilding every component. Without this option, the plugin only runs during `vite build`.
- **`failFast`** (boolean, optional, default: `false`): Abort the entire run when a single component fails to parse. By default, parse failures are collected as diagnostics (and reported to `stderr`) so the remaining components still emit their output. Also available as the `--fail-fast` CLI flag.
- **`resolveTypes`** (boolean, optional, default: `false`): Load the TypeScript program to expand opaque imported whole-object `$props()` types into JSON. See [Opt-in semantic resolution](#opt-in-semantic-resolution-resolvetypes).
- **`cache`** (boolean | string, optional, default: `false`): Write parsed component output to disk and skip re-parsing unchanged files on later runs. `true` uses `node_modules/.cache/sveld/parse-cache.json`; a string sets a custom path. Also available as `--cache` / `--cache=<path>`. See [Persistent parse cache](#persistent-parse-cache-cache).
- **`checkExamples`** (boolean, optional, default: `false`): Run plain TS/JS `@example` blocks through the TypeScript program. Broken ones get an `example-compile-error` diagnostic. See [Compile-checked `@example` blocks](#compile-checked-example-blocks-checkexamples).
- **`reportDiagnostics`** (boolean, optional, default: `false`): Print unresolved-type diagnostics to stderr (CLI) or `console.warn` (programmatic API). Also available as `--report-diagnostics`. See [Type inference diagnostics](#type-inference-diagnostics).
- **`strict`** (boolean, optional, default: `false`): Exit with code `1` when diagnostics exist. Implies `reportDiagnostics`. Also available as `--strict`. See [Type inference diagnostics](#type-inference-diagnostics).

By default, only TypeScript definitions are generated.

To generate documentation in Markdown and JSON formats, set `markdown` and `json` to `true`.

```diff
sveld({
+  markdown: true,
+  json: true,
})
```

## Documenting Entry Exports

Most entry barrels re-export more than `.svelte` components. Set `documentExports: true` to add consts, functions, and types to the JSON and Markdown output.

```diff
sveld({
  json: true,
  markdown: true,
+  documentExports: true,
})
```

Example entry file:

```ts
// src/index.ts
export { default as Button } from "./Button.svelte";
export { VERSION } from "./constants";
export { clamp } from "./utils";
export type { Theme } from "./types";
```

From that barrel, `sveld` documents `VERSION`, `clamp`, and `Theme`. `Button` still goes through the component path. Type text is copied from source, not resolved with `tsc`, same as the rest of the tool.

JSON adds `exports` and `totalExports`. Markdown adds an "Exports" section. Each item has `name`, `kind`, type text, optional JSDoc `description`, and `source`.

## JSON Output

When `json: true` is enabled, `sveld` emits a `COMPONENT_API.json` file with schema and generator metadata plus the parsed
component API. For stable output, generated `events` arrays are emitted in deterministic sorted order.

The JSON Schema lives on GitHub ([path to file](https://github.com/carbon-design-system/sveld/blob/main/schema/component-api.schema.json), [raw URL](https://raw.githubusercontent.com/carbon-design-system/sveld/main/schema/component-api.schema.json)). Use it to validate generated `COMPONENT_API.json` files. Optional fields may be missing when the parser has no stable source for that metadata.

```ts
interface ComponentApiJson {
  schemaVersion: 1;
  generator: {
    name: string;
    version: string;
    svelteVersion: string;
  };
  total: number;
  components: ComponentDocApi[];
  // Present only when `documentExports` is enabled.
  totalExports?: number;
  exports?: EntryExport[];
}

interface EntryExport {
  name: string;
  kind: "const" | "let" | "var" | "function" | "class" | "type" | "interface" | "enum";
  type?: string;
  value?: string;
  description?: string;
  source?: string;
  isTypeOnly: boolean;
}

interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

interface SourcePosition {
  line: number;
  column: number;
}

interface ComponentDocApi {
  moduleName: string;
  filePath: string;
  source?: SourceRange;
  syntaxMode: "legacy" | "runes";
  scriptLanguage?: "js" | "ts";
  props: ComponentProp[];
  moduleExports: ComponentProp[];
  slots: ComponentSlot[];
  events: ComponentEvent[];
  typedefs: TypeDef[];
  generics: null | [name: string, type: string];
  rest_props?: RestProps;
  extends?: { interface: string; import: string };
  componentComment?: string;
  componentCommentSource?: SourceRange;
  contexts?: ComponentContext[];
}

interface ComponentProp {
  name: string;
  localName?: string;
  kind: "let" | "const" | "function";
  constant: boolean;
  type?: string;
  typeSource?: "typescript" | "jsdoc" | "default" | "inferred" | "unknown";
  value?: string;
  defaultValue?: {
    raw: string;
    kind: "literal" | "array" | "object" | "expression" | "function" | "unknown";
    value?: unknown;
  };
  description?: string;
  params?: Array<{ name: string; type: string; description?: string; optional?: boolean }>;
  returnType?: string;
  isFunction: boolean;
  isFunctionDeclaration: boolean;
  isRequired: boolean;
  reactive: boolean;
  binding?: "readonly" | "writable";
  bindable?: true;
  source?: SourceRange;
}

interface ComponentSlot {
  name?: string | null;
  default: boolean;
  fallback?: string;
  slot_props?: string;
  description?: string;
  tags?: Array<{ name: string; body: string }>;
  source?: SourceRange;
}

type ComponentEvent =
  | {
      type: "forwarded";
      name: string;
      element: string;
      description?: string;
      detail?: string;
      source?: SourceRange;
    }
  | {
      type: "dispatched";
      name: string;
      detail?: string;
      description?: string;
      source?: SourceRange;
    };
```

`source` fields appear only when the Svelte or JavaScript AST has stable positions. They omit source text and raw character offsets.

`SourcePosition.line` is 1-based. `SourcePosition.column` is 0-based.

Prop metadata is additive and keeps the older public fields:

- `name` is always the public prop name. For runes `$props()` aliases such as `let { class: className } = $props()`, `localName` is emitted only when the local binding differs.
- `typeSource` identifies the conservative source of the emitted `type`: TypeScript annotation, JSDoc, initializer/default inference, other parser inference, or unknown fallback.
- `value` remains the raw default expression string. `defaultValue` adds structured metadata with the same raw expression, a coarse `kind`, and a parsed `value` only for JSON-safe literals, arrays, and plain objects. `sveld` does not evaluate arbitrary code.
- `bindable: true` is emitted only for props explicitly declared with Svelte 5 `$bindable(...)`. Missing `bindable` should be treated as false.

## API Reference

### `reactive`

The `reactive` field in generated JSON is a heuristic. It does not fully answer whether a parent can use `bind:prop` in Svelte.

`sveld` marks `reactive: true` when it finds internal evidence that a prop is writable, including:

- the prop is assigned or mutated inside the component
- the prop is marked bindable in runes mode with `$bindable(...)`
- the prop is used as the target of `bind:*` on an element or child component
- wrapper-forwarded bindings such as `bind:value`, `bind:selected`, and `bind:ref`

Local variables or parameters that shadow a prop name do not count as writes to the exported prop.

`reactive: false` means `sveld` found no such evidence. It does not imply that parent-side `bind:` usage is impossible.

### `binding`

The optional `binding` field documents a prop's intended `bind:` contract. It is separate from `reactive` and is never inferred from internal writes or `$bindable()`.

Use `@bindable readonly` for component-owned or output-style bindings where the consumer binds to the current value emitted by the component:

```svelte
<script>
  /**
   * Bind to the current value emitted by the component.
   * @bindable readonly
   */
  export let size = undefined;
</script>
```

Use `@bindable writable` for two-way or shared state bindings where either the consumer or component may control the value:

```svelte
<script>
  /**
   * Bind to state controlled by either the consumer or component.
   * @bindable writable
   */
  export let open = false;
</script>
```

Generated JSON includes `"binding": "readonly"` or `"binding": "writable"` for annotated props. Unannotated props omit the field.

This is documentation only. Generated `.svelte.d.ts` prop types do not change. TypeScript cannot express Svelte binding direction reliably.

### `@type`

Without a `@type` annotation, `sveld` infers the primitive type for a prop:

```js
export let kind = "primary";
// inferred type: "string"
```

For template literal default values, `sveld` infers the type as `string`:

```js
export let id = `ccs-${Math.random().toString(36)}`;
// inferred type: "string"
```

Use the `@type` tag to document the type explicitly. In the example below, `kind` is a string union.

For `lang="ts"` components, prefer native TypeScript annotations when you already have them. `@type` still helps in JavaScript components, for overriding inferred types, and when the AST cannot recover a sharper type.

**Signature:**

```js
/**
 * Optional description
 * @type {Type}
 */
```

**Example:**

```svelte
<script>
  let {
    /**
     * Specify the kind of button
     * @type {"primary" | "secondary" | "tertiary"}
     */
    kind = "primary",
    /**
     * Specify the Carbon icon to render
     * @type {typeof import("carbon-icons-svelte").CarbonIcon}
     */
    renderIcon = Close20,
  } = $props();
</script>
```

For runes components with multiple destructured props, put JSDoc on the property you want to document. A declaration-level block is a fallback when the destructure exposes a single public prop.

<details>
<summary>Svelte 3/4 (legacy) syntax</summary>

```svelte
<script>
  /**
   * Specify the kind of button
   * @type {"primary" | "secondary" | "tertiary"}
   */
  export let kind = "primary";

  /**
   * Specify the Carbon icon to render
   * @type {typeof import("carbon-icons-svelte").CarbonIcon}
   */
  export let renderIcon = Close20;
</script>
```

</details>

#### Importing types

`sveld` supports TypeScript's [`import(...)` type syntax](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html#import-types), so a `@type` or `@typedef` can reference a type from another module without a top-level `import`. The expression is copied verbatim into the generated `.d.ts` and resolves the same way as hand-written TypeScript:

- `import("module").Type` references an exported **type**.
- `typeof import("module").value` references the type of an exported **value**.
- `import("svelte").ComponentProps<...>` and other utility types compose with imports.

This keeps third-party types (Svelte stores, another component's props, library types) out of runtime imports while still showing up in IntelliSense for consumers.

**Example:**

```svelte
<script>
  /**
   * A store from `svelte/store`. No top-level `import` required.
   * @type {import("svelte/store").Writable<string>}
   */
  export let value;

  /**
   * `typeof import(...)` references the type of a value export, here the
   * `writable` factory itself rather than a type it exports.
   * @type {typeof import("svelte/store").writable}
   */
  export let createStore;

  /**
   * Reuse another component's props with Svelte's `ComponentProps` utility.
   * @type {import("svelte").ComponentProps<import("svelte").SvelteComponent>}
   */
  export let buttonProps;

  /**
   * `import(...)` works inside a `@typedef` too, which helps when typing values shared via `setContext` / `getContext`.
   *
   * @typedef {{ rows: import("svelte/store").Writable<string[]>; selected: import("svelte/store").Readable<number> }} TableContext
   */

  /** @type {TableContext} */
  export let context;
</script>
```

Output:

```ts
export interface TableContext {
  rows: import("svelte/store").Writable<string[]>;
  selected: import("svelte/store").Readable<number>;
}

export type ComponentProps = {
  /** @default undefined */
  value: import("svelte/store").Writable<string>;
  /** @default undefined */
  createStore: typeof import("svelte/store").writable;
  /** @default undefined */
  buttonProps: import("svelte").ComponentProps<import("svelte").SvelteComponent>;
  /** @default undefined */
  context: TableContext;
};
```

#### Prefer `unknown` over `any`

When a prop accepts data whose shape you do not know ahead of time, annotate it as `unknown` rather than `any`. `sveld` preserves either keyword in the emitted prop type, but they behave differently for consumers: `unknown` forces a narrowing check before use; `any` disables type checking everywhere the value flows. Reserve `any` for real escape hatches.

**Example:**

```svelte
<script>
  /**
   * A value of unknown shape. Prefer `unknown` over `any`: consumers must
   * narrow it before use instead of silently opting out of type checking.
   *
   * @type {unknown}
   */
  export let payload;

  /**
   * An escape hatch typed as `any`, shown for contrast. `any` disables type
   * checking everywhere it flows, so reach for `unknown` at boundaries instead.
   *
   * @type {any}
   */
  export let raw;
</script>
```

Output:

```ts
export type ComponentProps = {
  /** @default undefined */
  payload: unknown;
  /** @default undefined */
  raw: any;
};
```

Consumers must narrow an `unknown` prop before using it, while an `any` prop silently accepts anything:

```ts
function handle(props: ComponentProps) {
  // Error: 'payload' is of type 'unknown'. Narrow it first.
  props.payload.toUpperCase();

  if (typeof props.payload === "string") {
    props.payload.toUpperCase(); // OK after narrowing
  }
}
```

### `@default`

By default, `sveld` infers the `@default` value from the prop's initializer and includes it in the generated TypeScript definitions:

```svelte
<script>
  export let open = false;
</script>
```

```ts
/**
 * @default false
 */
open?: boolean;
```

Use `@default` to document the default value. When you supply `@default`, `sveld` uses it instead of the inferred value and avoids duplicate `@default` tags in the output.

Use `@default` when the initializer references a variable or expression that means nothing to consumers:

```svelte
<script>
  const defaultFilter = () => true;

  /**
   * @default () => true
   * @type {(item: string, value: string) => boolean}
   */
  export let shouldFilter = defaultFilter;
</script>
```

```ts
/**
 * @default () => true
 */
shouldFilter?: (item: string, value: string) => boolean;
```

#### Identifier resolution

When a prop's initializer is a variable reference, `sveld` resolves it to the actual value:

```svelte
<script>
  const DEFAULT_SIZE = "md";

  /** @type {"sm" | "md" | "lg"} */
  export let size = DEFAULT_SIZE;
</script>
```

```ts
/**
 * @default "md"
 */
size?: "sm" | "md" | "lg";
```

Chained references are also resolved:

```svelte
<script>
  const ACTUAL_VALUE = 42;
  const ALIAS = ACTUAL_VALUE;

  export let count = ALIAS;
</script>
```

```ts
/**
 * @default 42
 */
count?: number;
```

Resolution follows up to 5 levels of indirection. Beyond that, the last resolved identifier name is used as the default value. If the identifier cannot be resolved (e.g., it is imported from another module), the variable name is used as-is.

When an explicit `@default` annotation is provided, it always takes precedence over the resolved value.

### `@typedef`

The `@typedef` tag defines a shared type used multiple times in a component. All typedefs in a component are exported from the generated `.d.ts`.

**Signature:**

```js
/**
 * @typedef {Type} TypeName
 */
```

**Example:**

```svelte
<script>
  /**
   * @typedef {string} AuthorName
   * @typedef {{ name?: AuthorName; dob?: string; }} Author
   */

  let {
    /** @type {Author} */
    author = {},
    /** @type {Author[]} */
    authors = [],
  } = $props();
</script>
```

<details>
<summary>Svelte 3/4 (legacy) syntax</summary>

```svelte
<script>
  /**
   * @typedef {string} AuthorName
   * @typedef {{ name?: AuthorName; dob?: string; }} Author
   */

  /** @type {Author} */
  export let author = {};

  /** @type {Author[]} */
  export let authors = [];
</script>
```

</details>

#### Using `@property` for complex typedefs

For complex object types, use `@property` to document individual fields. That gives per-property tooltips in the IDE.

**Signature:**

```js
/**
 * Type description
 * @typedef {object} TypeName
 * @property {Type} propertyName - Property description
 */
```

**Example:**

```svelte
<script>
  /**
   * Represents a user in the system
   * @typedef {object} User
   * @property {string} name - The user's full name
   * @property {string} email - The user's email address
   * @property {number} age - The user's age in years
   */

  /** @type {User} */
  let { user = { name: "John", email: "john@example.com", age: 30 } } = $props();
</script>
```

<details>
<summary>Svelte 3/4 (legacy) syntax</summary>

```svelte
<script>
  /**
   * Represents a user in the system
   * @typedef {object} User
   * @property {string} name - The user's full name
   * @property {string} email - The user's email address
   * @property {number} age - The user's age in years
   */

  /** @type {User} */
  export let user = { name: "John", email: "john@example.com", age: 30 };
</script>
```

</details>

Output is identical for both syntax modes.

Output:

```ts
export type User = {
  /** The user's full name */
  name: string;
  /** The user's email address */
  email: string;
  /** The user's age in years */
  age: number;
};

export type ComponentProps = {
  /**
   * Represents a user in the system
   * @default { name: "John", email: "john@example.com", age: 30 }
   */
  user?: User;
};
```

#### Optional properties and default values

Use square brackets for optional properties, per JSDoc. Default values use `[propertyName=defaultValue]`.

**Signature:**

```js
/**
 * @typedef {object} TypeName
 * @property {Type} [optionalProperty] - Optional property description
 * @property {Type} [propertyWithDefault=defaultValue] - Property with default value
 */
```

**Example:**

```svelte
<script>
  /**
   * Configuration options for the component
   * @typedef {object} ComponentConfig
   * @property {boolean} enabled - Whether the component is enabled
   * @property {string} theme - The component theme
   * @property {number} [timeout=5000] - Optional timeout in milliseconds
   * @property {boolean} [debug] - Optional debug mode flag
   */

  /** @type {ComponentConfig} */
  let { config = { enabled: true, theme: "dark" } } = $props();
</script>
```

<details>
<summary>Svelte 3/4 (legacy) syntax</summary>

```svelte
<script>
  /**
   * Configuration options for the component
   * @typedef {object} ComponentConfig
   * @property {boolean} enabled - Whether the component is enabled
   * @property {string} theme - The component theme
   * @property {number} [timeout=5000] - Optional timeout in milliseconds
   * @property {boolean} [debug] - Optional debug mode flag
   */

  /** @type {ComponentConfig} */
  export let config = { enabled: true, theme: "dark" };
</script>
```

</details>

Output is identical for both syntax modes.

Output:

```ts
export type ComponentConfig = {
  /** Whether the component is enabled */
  enabled: boolean;
  /** The component theme */
  theme: string;
  /** Optional timeout in milliseconds @default 5000 */
  timeout?: number;
  /** Optional debug mode flag */
  debug?: boolean;
};

export type ComponentProps = {
  /**
   * Configuration options for the component
   * @default { enabled: true, theme: "dark" }
   */
  config?: ComponentConfig;
};
```

> The inline syntax `@typedef {{ name: string }} User` still works for backwards compatibility.

#### Discriminated unions

A `@typedef` can be a union of object literals, optionally mixed with primitive members. `sveld` emits these as `export type X = ...` aliases (not `interface`), so the discriminant narrows correctly on the consumer side.

**Signature:**

```js
/**
 * @typedef {A | B | C} TypeName
 */
```

**Example:**

```svelte
<script>
  /**
   * @typedef {{ kind: "success"; value: string } | { kind: "error"; error: Error }} Result
   * @typedef {{ ok: true; data: number } | { ok: false; reason: string } | "pending"} Status
   */

  /** @type {Result} */
  export let result = { kind: "success", value: "ok" };

  /** @type {Status} */
  export let status = "pending";
</script>
```

Output:

```ts
export type Result = { kind: "success"; value: string } | { kind: "error"; error: Error };

export type Status = { ok: true; data: number } | { ok: false; reason: string } | "pending";

export type ComponentProps = {
  /** @default { kind: "success", value: "ok" } */
  result?: Result;
  /** @default "pending" */
  status?: Status;
};
```

Consumers can then narrow on the discriminant:

```ts
function describe(r: Result) {
  switch (r.kind) {
    case "success":
      return r.value;
    case "error":
      return r.error.message;
  }
}
```

The same pattern works inline via `@type`, which is useful when the union is only used for a single prop:

```js
/** @type {{ kind: "success"; value: string } | { kind: "error"; error: Error }} */
export let result = { kind: "success", value: "ok" };
```

In `<script lang="ts">` components, write the type alias directly. `sveld` preserves it in the emitted `.d.ts`:

```svelte
<script lang="ts">
  type Result = { kind: "success"; value: string } | { kind: "error"; error: Error };

  let { result = { kind: "success", value: "ok" } }: { result?: Result } = $props();
</script>
```

#### Branded types

A branded type is a primitive plus a unique marker so values like `UserId` are not interchangeable with any other `string`. At runtime it is still the underlying primitive; TypeScript treats the brand as a separate type. Declare the brand inline with `@type`. `sveld` copies the intersection verbatim into the emitted prop type, so the brand shows up in IntelliSense, autocomplete, and hover tooltips on the consumer side.

**Example:**

```svelte
<script>
  /**
   * A branded string. At runtime it is a plain `string`, but the brand makes it
   * a distinct domain type that other strings cannot be assigned to.
   *
   * @type {string & { readonly __brand: "UserId" }}
   */
  export let userId;

  /**
   * A branded number representing a monetary amount in cents.
   *
   * @type {number & { readonly __brand: "Cents" }}
   */
  export let amount;
</script>
```

Output:

```ts
export type ComponentProps = {
  /**
   * A branded string. At runtime it is a plain `string`, but the brand makes it
   * a distinct domain type that other strings cannot be assigned to.
   * @default undefined
   */
  userId: string & { readonly __brand: "UserId" };

  /**
   * A branded number representing a monetary amount in cents.
   * @default undefined
   */
  amount: number & { readonly __brand: "Cents" };
};
```

Consumers construct branded values with a narrowing cast, then get compile-time protection against mixing them up:

```ts
const userId = "user_123" as ComponentProps["userId"];

// Error: a plain string is not assignable to the branded userId
component.$set({ userId: "user_123" });
```

#### Utility types

`sveld` preserves TypeScript utility types verbatim, so a prop type can be derived from an existing `@typedef` instead of restating its fields. `Pick`, `Omit`, `Partial`, `Required`, `Readonly`, `ReturnType`, `Parameters`, and `Awaited` pass through unchanged. When the base type changes, derived props follow.

**Example:**

```svelte
<script>
  /**
   * @typedef {{ id: string; size: "sm" | "md" | "lg"; disabled: boolean }} Options
   */

  /**
   * @typedef {() => Options} Factory
   */

  /**
   * A subset of `Options`.
   * @type {Pick<Options, "id" | "size">}
   */
  export let summary;

  /**
   * Everything in `Options` except `disabled`.
   * @type {Omit<Options, "disabled">}
   */
  export let editable;

  /**
   * Derived from the factory's return type rather than restated.
   * @type {ReturnType<Factory>}
   */
  export let defaults;

  /**
   * The resolved value of an async source.
   * @type {Awaited<Promise<Options>>}
   */
  export let resolved;
</script>
```

Output:

```ts
export interface Options {
  id: string;
  size: "sm" | "md" | "lg";
  disabled: boolean;
}

export type Factory = () => Options;

export type ComponentProps = {
  summary: Pick<Options, "id" | "size">;
  editable: Omit<Options, "disabled">;
  defaults: ReturnType<Factory>;
  resolved: Awaited<Promise<Options>>;
};
```

#### Type guards

A prop typed as a [type predicate](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates) (`value is T`) lets a component accept a user-defined type guard. `sveld` copies the predicate verbatim, whether you write it inline with `@type` or name it with `@typedef`, so narrowing survives in the generated `.d.ts`. Name guards `isX` or `hasX`, and make sure the implementation actually checks what the predicate claims.

**Example:**

```svelte
<script>
  /**
   * @typedef {{ id: string; name: string }} User
   */

  /**
   * A type guard. It accepts an `unknown` value and returns a type predicate,
   * so callers can narrow `unknown` to `User` before accessing its fields.
   *
   * @type {(value: unknown) => value is User}
   */
  export let isUser;

  /**
   * A type guard expressed as a reusable `@typedef`.
   *
   * @typedef {(value: unknown) => value is User} UserGuard
   */

  /** @type {UserGuard} */
  export let validate;
</script>
```

Output:

```ts
export interface User {
  id: string;
  name: string;
}

export type UserGuard = (value: unknown) => value is User;

export type ComponentProps = {
  isUser: (value: unknown) => value is User;
  validate: UserGuard;
};
```

Consumers use the guard to narrow an `unknown` value:

```ts
function render(value: unknown, props: ComponentProps) {
  if (props.isUser(value)) {
    value.name; // narrowed to User
  }
}
```

### `@callback`

The `@callback` tag defines a function type with `@param` and `@returns`, following the [TypeScript JSDoc `@callback` spec](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html#callback). Like `@typedef`, callbacks are exported from the generated `.d.ts`.

Use it for callback props when you do not want inline function type syntax.

**Signature:**

```js
/**
 * Optional description
 * @callback CallbackName
 * @param {Type} paramName - Parameter description
 * @returns {ReturnType}
 */
```

**Example:**

```svelte
<script>
  /**
   * Callback fired when the value changes
   * @callback OnChange
   * @param {string} value - The new value
   * @param {number} index - The index of the changed item
   * @returns {void}
   */

  /** @type {OnChange} */
  let { onChange = (value, index) => {} } = $props();
</script>
```

<details>
<summary>Svelte 3/4 (legacy) syntax</summary>

```svelte
<script>
  /**
   * Callback fired when the value changes
   * @callback OnChange
   * @param {string} value - The new value
   * @param {number} index - The index of the changed item
   * @returns {void}
   */

  /** @type {OnChange} */
  export let onChange = (value, index) => {};
</script>
```

</details>

Output is identical for both syntax modes.

Output:

```ts
/**
 * Callback fired when the value changes
 */
export type OnChange = (value: string, index: number) => void;

export type ComponentProps = {
  /**
   * Callback fired when the value changes
   */
  onChange?: OnChange;
};
```

Callbacks can be combined with `@typedef` in the same comment block:

```js
/**
 * @typedef {"asc" | "desc"} SortDirection
 * @callback SortFn
 * @param {any} a
 * @param {any} b
 * @param {SortDirection} direction
 * @returns {number}
 */
```

When `@returns` is omitted, the return type defaults to `void`. When no `@param` tags are present, the callback is typed as a no-argument function.

### `@slot` / `@snippet`

Use `@slot` to type component slots. In Svelte 5 runes components, `@snippet` is an alias. Both are non-standard JSDoc tags.

Descriptions are optional for every slot, including the default slot. Put prose in the same `/** */` block above `@slot` / `@snippet`, or an inline description on the `@slot` line for named slots.

**Signature:**

```js
/**
 * @slot {Type} slot-name [slot description]
 * @snippet {Type} snippet-name [snippet description]
 */
```

Omit the `slot-name` to type the default slot.

```js
/**
 * @slot {Type}
 * @snippet {Type}
 */
```

**Example:**

```svelte
<script>
  /**
   * @snippet {{ prop: number; doubled: number; }}
   * @snippet {{}} title
   * @snippet {{ prop: number }} body - Customize the paragraph text.
   */

  let { prop = 0, children, title, body } = $props();
</script>

<h1>
  {@render children?.({ prop, doubled: prop * 2 })}
  {@render title?.()}
</h1>

<p>
  {@render body?.({ prop })}
</p>
```

<details>
<summary>Svelte 3/4 (legacy) syntax</summary>

```svelte
<script>
  /**
   * @slot {{ prop: number; doubled: number; }}
   * @slot {{}} title
   * @slot {{ prop: number }} body - Customize the paragraph text.
   */

  export let prop = 0;
</script>

<h1>
  <slot {prop} doubled={prop * 2} />
  <slot name="title" />
</h1>

<p>
  <slot name="body" {prop} />
</p>
```

</details>

#### Extra JSDoc tags before `@slot`

Tags such as `@example`, `@see`, or `@since` that appear after the prose description and before the `@slot` / `@snippet` line are copied into generated `.d.ts` files. The emitted JSDoc above each slot's snippet prop (and the traditional `SlotDefs` shape) lists the description, then those tags in source order. The same entries appear in JSON as `tags: [{ "name", "body" }, ...]`.

`@deprecated` is handled separately from passthrough slot tags. It fills the slot's `deprecated` JSON field, adds a Markdown badge, and emits `@deprecated` in the `.d.ts`. See [@deprecated](#deprecated).

Put `@slot` / `@snippet` last in the block (description, optional extra tags, slot tag). Tags after `@slot` / `@snippet` in the same comment are not tied to that slot. Unknown tag names pass through as-is. Markdown docs render the description and these tags in the slot's **Description** column (newlines and tag boundaries become `<br />`), alongside TypeScript hover and JSON.

**Example (default slot with `@example` and `@deprecated`):**

````svelte
<script>
  /**
   * Spread `props` onto a custom element.
   * @example
   * ```svelte
   * <Item let:props>
   *   <a {...props} href="/">Home</a>
   * </Item>
   * ```
   * @deprecated Prefer the `link` snippet.
   * @slot {{ props?: { class: string } }}
   */
</script>

<slot props={{ class: "bx--link" }} />
````

#### Svelte 5 Snippet Compatibility

For Svelte 5, `sveld` generates optional snippet props for all slots so consumers can use traditional slot syntax or `{#snippet}`.

When parsing runes components, `sveld` maps `{@render ...}` calls back into the same slot metadata used for `<slot>`. Reserved snippet props like `children`, plus named snippet props from `{@render ...}`, live in `slots` metadata and generated snippet prop types, not duplicated in `props`.

Positional snippet calls like `{@render row?.(item, index)}` stay typed props when the prop has an explicit type like `Snippet<[Item, number]>`. They are not turned into synthetic slot metadata.

For slots with props (e.g., `let:prop`), the generated type uses a Snippet-compatible signature:

```ts
slotName?: (this: void, ...args: [{ prop: PropType }]) => void;
```

For slots without props:

```ts
slotName?: (this: void) => void;
```

**Why this signature?**

- **`this: void`** blocks calling the snippet with a `this` context, matching Svelte's rule that snippets are pure render functions
- **`...args: [Props]`** uses tuple spread for type-safe parameters. It accepts fixed-length tuples (like `[{ row: Row }]`) and rejects array types (like `Props[]`), matching Svelte's `Snippet<T>` type

**Default slot (`children` prop):**

The default slot generates an optional `children` snippet prop:

```svelte
<!-- Component with default slot that passes props -->
<Dropdown {items} selectedId="1">
  {#snippet children({ item, index })}
    <span>{item.text} (#{index})</span>
  {/snippet}
</Dropdown>
```

Generated types:

```ts
type DropdownProps = {
  items: Item[];
  selectedId?: string;

  // Default slot as children snippet prop
  children?: (this: void, ...args: [{ item: Item; index: number }]) => void;
};
```

**Named slots:**

```svelte
<!-- Using the generated types with Svelte 5 syntax -->
<DataTable headers={headers} rows={rows}>
  {#snippet cell({ cell, row })}
    {#if cell.key === 'actions'}
      <Button on:click={() => handleAction(row)}>Edit</Button>
    {:else}
      {cell.value}
    {/if}
  {/snippet}
</DataTable>
```

Generated output includes both the snippet prop and the traditional slot definition:

```ts
type DataTableProps<Row> = {
  // ... other props

  // Snippet prop for Svelte 5 compatibility
  cell?: (
    this: void,
    ...args: [
      {
        row: Row;
        cell: DataTableCell<Row>;
        rowIndex: number;
        cellIndex: number;
      },
    ]
  ) => void;

  // Default slot as children prop
  children?: (this: void) => void;
};

export default class DataTable<Row> extends SvelteComponentTyped<
  DataTableProps<Row>,
  {
    /* events */
  },
  {
    // Traditional slot definition (Svelte 3/4)
    default: Record<string, never>;
    cell: {
      row: Row;
      cell: DataTableCell<Row>;
      rowIndex: number;
      cellIndex: number;
    };
  }
> {}
```

### `@event`

Use the `@event` tag to type dispatched events. An event name is required and a description optional.

In Svelte 5 runes components, callback props like `onclick` are props, not events. The `events` output stays reserved for dispatched events and legacy forwarded events. If a runes component documents `@event foo` and exposes a matching callback prop like `onfoo` without actually dispatching or forwarding `foo`, `sveld` aliases that documentation onto the callback prop instead of synthesizing an emitted event.

Use `null` as the value if no event detail is provided.

**Signature:**

```js
/**
 * Optional event description
 * @event {EventDetail} eventname [inline description]
 */
```

**Example:**

```svelte
<script>
  /**
   * Fired when a value is saved.
   * @event {{ id: string }} save
   */
  let { onsave } = $props();
</script>

<button onclick={() => onsave?.({ id: "1" })}>Save</button>
```

**Svelte 5 Runes with dispatched events:**

```svelte
<script>
  /**
   * @event {{ key: string }} button:key
   * @event {null} key - Fired when `key` changes.
   */

  let { key = "" } = $props();

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  $effect(() => {
    dispatch("button:key", { key });
    if (key) dispatch("key");
  });
</script>
```

<details>
<summary>Svelte 3/4 (legacy) syntax</summary>

```svelte
<script>
  /**
   * @event {{ key: string }} button:key
   * @event {null} key - Fired when `key` changes.
   */

  export let key = "";

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  $: dispatch("button:key", { key });
  $: if (key) dispatch("key");
</script>
```

</details>

Output is identical for both syntax modes.

Output:

```ts
export default class Component extends SvelteComponentTyped<
  ComponentProps,
  {
    "button:key": CustomEvent<{ key: string }>;
    /** Fired when `key` changes. */ key: CustomEvent<null>;
  },
  Record<string, never>
> {}
```

#### Using `@property` for complex event details

For events with complex object payloads, use `@property` to document individual fields. The main comment becomes the event description.

This is the idiomatic way to describe each field of an event detail. An inline object literal such as `@event {{ items: string[]; added: string[] }} change` types the payload but cannot carry per-field descriptions, since a nested block comment would terminate the host JSDoc. Declare the detail with `@type {object}` and `@property` instead to document every field.

**Signature:**

```js
/**
 * Event description
 * @event eventname
 * @type {object}
 * @property {Type} propertyName - Property description
 */
```

**Example:**

```svelte
<script>
  /**
   * Fired when the user submits the form
   *
   * @event submit
   * @type {object}
   * @property {string} name - The user's name
   * @property {string} email - The user's email address
   * @property {boolean} newsletter - Whether the user opted into the newsletter
   */

  let { name = "Jane Doe", email = "jane@example.com", newsletter = true } = $props();

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  function handleSubmit() {
    dispatch("submit", { name, email, newsletter });
  }
</script>

<button type="button" onclick={handleSubmit}>Submit</button>
```

<details>
<summary>Svelte 3/4 (legacy) syntax</summary>

```svelte
<script>
  /**
   * Fired when the user submits the form
   *
   * @event submit
   * @type {object}
   * @property {string} name - The user's name
   * @property {string} email - The user's email address
   * @property {boolean} newsletter - Whether the user opted into the newsletter
   */

  export let name = "Jane Doe";
  export let email = "jane@example.com";
  export let newsletter = true;

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  function handleSubmit() {
    dispatch("submit", { name, email, newsletter });
  }
</script>

<button type="button" on:click={handleSubmit}>Submit</button>
```

</details>

Output is identical for both syntax modes.

Output:

```ts
export default class Component extends SvelteComponentTyped<
  ComponentProps,
  {
    /** Fired when the user submits the form */
    submit: CustomEvent<{
      /** The user's name */
      name: string;
      /** The user's email address */
      email: string;
      /** Whether the user opted into the newsletter */
      newsletter: boolean;
    }>;
  },
  Record<string, never>
> {}
```

#### Optional properties in event details

Like typedefs, you can mark event detail properties as optional with square brackets when they are not always in the payload.

**Example:**

```svelte
<script>
  /**
   * Snowball event fired when throwing a snowball
   *
   * @event snowball
   * @type {object}
   * @property {boolean} isPacked - Indicates whether the snowball is tightly packed
   * @property {number} speed - The speed of the snowball in mph
   * @property {string} [color] - Optional color of the snowball
   * @property {number} [density=0.9] - Optional density with default value
   */

  let { speed = 50 } = $props();

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  function throwSnowball() {
    dispatch("snowball", {
      isPacked: true,
      speed,
    });
  }
</script>

<button type="button" onclick={throwSnowball}>Throw</button>
```

<details>
<summary>Svelte 3/4 (legacy) syntax</summary>

```svelte
<script>
  /**
   * Snowball event fired when throwing a snowball
   *
   * @event snowball
   * @type {object}
   * @property {boolean} isPacked - Indicates whether the snowball is tightly packed
   * @property {number} speed - The speed of the snowball in mph
   * @property {string} [color] - Optional color of the snowball
   * @property {number} [density=0.9] - Optional density with default value
   */

  export let speed = 50;

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  function throwSnowball() {
    dispatch("snowball", {
      isPacked: true,
      speed,
    });
  }
</script>

<button type="button" on:click={throwSnowball}>Throw</button>
```

</details>

Output is identical for both syntax modes.

Output:

```ts
export default class Component extends SvelteComponentTyped<
  ComponentProps,
  {
    /** Snowball event fired when throwing a snowball */
    snowball: CustomEvent<{
      /** Indicates whether the snowball is tightly packed */
      isPacked: boolean;
      /** The speed of the snowball in mph */
      speed: number;
      /** Optional color of the snowball */
      color?: string;
      /** Optional density with default value @default 0.9 */
      density?: number;
    }>;
  },
  Record<string, never>
> {}
```

#### Discriminated unions in event details

When the event detail is a union (or any non-object shape), use `@type` to declare it directly. An explicit `@type` wins over `@property` tags, so the union is copied verbatim into the emitted `.d.ts` instead of being flattened into independent property unions. The only exception is `@type {object}`, which tells `sveld` to build the shape from `@property` tags (as shown above).

**Example:**

```svelte
<script>
  /**
   * @event sort
   * @type {{ key: null; direction: "none" } | { key: string; direction: "ascending" | "descending" }}
   * Dispatched when a sortable column header would change the active sort.
   */

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();
</script>
```

Output:

```ts
export default class Component extends SvelteComponentTyped<
  ComponentProps,
  {
    /** Dispatched when a sortable column header would change the active sort. */
    sort: CustomEvent<{ key: null; direction: "none" } | { key: string; direction: "ascending" | "descending" }>;
  },
  Record<string, never>
> {}
```

Any free-text prose after the tags is attached to the event description, not to a property doc.

### `@deprecated`

Add `@deprecated` to a prop, event, slot, or exported accessor. An optional message after the tag can explain why or name a replacement.

```svelte
<script>
  /**
   * The visible label.
   * @deprecated Use the `text` prop instead.
   */
  export let label = "";

  /**
   * Programmatically focus the field.
   * @deprecated Focus the underlying element directly.
   */
  export function focus() {}

  /**
   * @event {{ value: string }} change
   * @deprecated Listen for the native `input` event instead.
   */

  /**
   * Badge content rendered next to the label.
   * @deprecated Render the badge inline instead.
   * @slot {{ count: number }} badge
   */
</script>
```

For slots, put `@deprecated` before the `@slot` / `@snippet` line, alongside the description and any other [extra tags](#extra-jsdoc-tags-before-slot). For events, put it after the `@event` line.

Generated `.d.ts` files include an `@deprecated` JSDoc line so editors strike the symbol through. JSON adds a `deprecated` field (the message string, or `true` when the tag has no message). Markdown strikes through the name and adds a **Deprecated** badge with the message when present.

```ts
/**
 * The visible label.
 * @deprecated Use the `text` prop instead.
 */
label?: string;
```

```json
{ "name": "label", "deprecated": "Use the `text` prop instead." }
```

### Context API

`sveld` generates TypeScript definitions for Svelte's `setContext`/`getContext` by extracting types from JSDoc on context values.

#### How it works

When you call `setContext` in a component, `sveld`:

1. Detects the `setContext` call
2. Resolves the context key (see [Supported context keys](#supported-context-keys))
3. Finds JSDoc `@type` annotations on the variables being passed
4. Generates a TypeScript type export for the context

#### Supported context keys

The key becomes the `{PascalCase}Context` type name. `sveld` can resolve:

| Key form | Example | Generated type |
| --- | --- | --- |
| String literal | `setContext("simple-modal", …)` | `SimpleModalContext` |
| Static template literal | `` setContext(`simple-modal`, …) `` | `SimpleModalContext` |
| `const`-bound string | `const KEY = "simple-modal";`<br>`setContext(KEY, …)` | `SimpleModalContext` |
| `Symbol()` / `Symbol.for()` | `setContext(Symbol("tabs"), …)` | `TabsContext` |

`const` identifiers are followed up to 5 levels deep (`const A = "x"; const B = A;`). Only `const` bindings count. `let`, `var`, and props are skipped because they can change at runtime.

Symbol keys take their name from the description: `Symbol("tabs")` and `Symbol.for("tabs")` both become `TabsContext`. For `const ModalKey = Symbol()` with no description, the binding name wins: `ModalKeyContext`.

Anything else (dynamic identifiers, template interpolation, other function calls) logs a warning. No context type is generated.

#### Example

**Modal.svelte**

```svelte
<script>
  import { setContext } from "svelte";

  /**
   * Close the modal
   * @type {() => void}
   */
  const close = () => {
    // Close logic
  };

  /**
   * Open the modal with content
   * @type {(component: any, props?: any) => void}
   */
  const open = (component, props) => {
    // Open logic
  };

  setContext("simple-modal", { open, close });

  let { children } = $props();
</script>

<div class="modal">
  {@render children?.()}
</div>
```

<details>
<summary>Svelte 3/4 (legacy) syntax</summary>

```svelte
<script>
  import { setContext } from "svelte";

  /**
   * Close the modal
   * @type {() => void}
   */
  const close = () => {
    // Close logic
  };

  /**
   * Open the modal with content
   * @type {(component: any, props?: any) => void}
   */
  const open = (component, props) => {
    // Open logic
  };

  setContext("simple-modal", { open, close });
</script>

<div class="modal">
  <slot />
</div>
```

</details>

Output is identical for both syntax modes.

**Generated TypeScript definition:**

```ts
export type SimpleModalContext = {
  /** Open the modal with content */
  open: (component: any, props?: any) => void;
  /** Close the modal */
  close: () => void;
};

export type ModalProps = {};

export default class Modal extends SvelteComponentTyped<
  ModalProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
```

**Consumer usage:**

```svelte
<script>
  import { getContext } from 'svelte';
  import type { SimpleModalContext } from 'modal-library/Modal.svelte';

  const { close, open } = getContext<SimpleModalContext>('simple-modal');
</script>

<button on:click={close}>Close</button>
```

#### Explicitly typing contexts

There are several ways to type contexts:

**Option 1: Inline JSDoc on variables (recommended)**

```svelte
<script>
  import { setContext } from 'svelte';

  /**
   * @type {() => void}
   */
  const close = () => {};

  setContext('modal', { close });
</script>
```

**Option 2: Using @typedef for complex types**

```svelte
<script>
  import { setContext } from 'svelte';

  /**
   * @typedef {object} TabData
   * @property {string} id
   * @property {string} label
   * @property {boolean} [disabled]
   */

  /**
   * @type {(tab: TabData) => void}
   */
  const addTab = (tab) => {};

  setContext('tabs', { addTab });
</script>
```

**Option 3: Referencing imported types**

```svelte
<script>
  import { setContext } from 'svelte';

  /**
   * @type {typeof import("./types").ModalAPI}
   */
  const modalAPI = {
    open: () => {},
    close: () => {}
  };

  setContext('modal', modalAPI);
</script>
```

**Option 4: Direct object literal with inline functions**

```svelte
<script>
  import { setContext } from 'svelte';

  // sveld infers basic function signatures
  setContext('modal', {
    open: (component, props) => {}, // Inferred as (arg, arg) => any
    close: () => {}                 // Inferred as () => any
  });
</script>
```

> Inline functions without `@type` annotations get generic inferred signatures. Add explicit JSDoc when you care about the shape.

#### Notes

- Context keys must be statically resolvable: a string literal, a static template literal, a `const`-bound string, or a `Symbol()` / `Symbol.for()` call with a static description. Dynamic expressions (runtime identifiers, template interpolation, other function calls) are skipped with a warning.
- Variables passed to `setContext` should have JSDoc `@type` annotations for accurate types
- The generated type name follows the pattern: `{PascalCase}Context`. Separators (hyphens, underscores, dots, colons, slashes, spaces) are stripped and each segment is capitalized:
  | Context Key | Generated Type Name |
  | --- | --- |
  | `"simple-modal"` | `SimpleModalContext` |
  | `"user_settings"` | `UserSettingsContext` |
  | `"Carbon.Modal"` | `CarbonModalContext` |
  | `"Carbon:Modal"` | `CarbonModalContext` |
  | `"app/modal"` | `AppModalContext` |
  | `"My Context"` | `MyContextContext` |
  | `"Tabs"` | `TabsContext` |
- If no type annotation is found, the type defaults to `any` with a warning

### `@restProps`

`sveld` can detect inline HTML elements that `$$restProps` is forwarded to. It cannot infer the underlying element for instantiated components.

Use `@restProps` to name the element tags `$$restProps` is forwarded to.

**Signature:**

```js
/**
 * Single element
 * @restProps {tagname}
 *
 * Multiple elements
 * @restProps {tagname-1 | tagname-2 | tagname-3}
 */
```

**Example:**

```svelte
<script>
  import Button from "./Button.svelte";

  /** @restProps {h1 | button} */
  let { edit = false, children, ...restProps } = $props();
</script>

{#if edit}
  <Button {...restProps} />
{:else}
  <h1 {...restProps}>
    {@render children?.()}
  </h1>
{/if}
```

<details>
<summary>Svelte 3/4 (legacy) syntax</summary>

```svelte
<script>
  /** @restProps {h1 | button} */
  export let edit = false;

  import Button from "./Button.svelte";
</script>

{#if edit}
  <Button {...$$restProps} />
{:else}
  <h1 {...$$restProps}><slot /></h1>
{/if}
```

</details>

### `@extendProps`

When a component wraps another, use `@extendProps` to extend generated props.

> `@extends` works as an alias, but prefer `@extendProps` to avoid clashing with standard JSDoc `@extends` for class inheritance.

**Signature:**

```js
/**
 * @extendProps {<relative path to component>} ComponentProps
 */
```

**Example:**

```js
/** @extendProps {"./Button.svelte"} ButtonProps */

export const secondary = true;

import Button from "./Button.svelte";
```

### `@template`

Svelte supports defining generics via the [`generics` attribute](https://svelte.dev/docs/svelte/typescript) on the script tag, but this requires `lang="ts"`.

```svelte
<!-- Requires lang="ts" -->
<script lang="ts" generics="Row extends DataTableRow = any"></script>
```

Because `sveld` targets JavaScript-only usage as a baseline, generics use the standard JSDoc `@template` tag. `@generics` is also supported as an alias.

**Signature:** Uses standard [JSDoc `@template` syntax](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html#template):

```js
/**
 * @template {Constraint} [Name=Default]
 */
```

**Example:**

```js
/**
 * @template {DataTableRow} [Row=DataTableRow]
 */
```

**Component example:**

```svelte
<script>
  /**
   * @typedef {{ id: string | number; [key: string]: any; }} DataTableRow
   * @typedef {Exclude<keyof Row, "id">} DataTableKey<Row>
   * @typedef {{ key: DataTableKey<Row>; value: string; }} DataTableHeader<Row=DataTableRow>
   * @template {DataTableRow} [Row=DataTableRow]
   */

  let {
    /** @type {ReadonlyArray<DataTableHeader<Row>>} */
    headers = [],
    /** @type {ReadonlyArray<Row>} */
    rows = [],
    children,
  } = $props();
</script>

{@render children?.({ headers, rows })}
```

<details>
<summary>Svelte 3/4 (legacy) syntax</summary>

```svelte
<script>
  /**
   * @typedef {{ id: string | number; [key: string]: any; }} DataTableRow
   * @typedef {Exclude<keyof Row, "id">} DataTableKey<Row>
   * @typedef {{ key: DataTableKey<Row>; value: string; }} DataTableHeader<Row=DataTableRow>
   * @template {DataTableRow} [Row=DataTableRow]
   */

  /** @type {ReadonlyArray<DataTableHeader<Row>>} */
  export let headers = [];

  /** @type {ReadonlyArray<Row>} */
  export let rows = [];
</script>

<slot {headers} {rows} />
```

</details>

Output is identical for both syntax modes.

Generated output looks like this:

```ts
export type ComponentProps<Row extends DataTableRow = DataTableRow> = {
  headers?: ReadonlyArray<DataTableHeader<Row>>;
  rows?: ReadonlyArray<Row>;
};

export default class Component<
  Row extends DataTableRow = DataTableRow,
> extends SvelteComponentTyped<
  ComponentProps<Row>,
  Record<string, any>,
  Record<string, any>
> {}
```

For multiple generics, use separate `@template` tags:

```js
/**
 * @template {DataTableRow} [Row=DataTableRow]
 * @template {DataTableRow} [Header=DataTableRow]
 */
```

```ts
export type ComponentProps<
  Row extends DataTableRow = DataTableRow,
  Header extends DataTableRow = DataTableRow,
> = { ... };

export default class Component<
  Row extends DataTableRow = DataTableRow,
  Header extends DataTableRow = DataTableRow,
> extends SvelteComponentTyped<
  ComponentProps<Row, Header>,
  Record<string, any>,
  Record<string, any>
> {}
```

### `@generics`

As an alternative to `@template`, sveld supports `@generics`. Unlike `@template`, which [JSDoc/TypeScript support officially](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html#template), `@generics` is sveld-specific. The syntax can be easier to read because the full constraint is inline:

```js
/**
 * @generics {Row extends DataTableRow = DataTableRow} Row
 */
```

This is equivalent to:

```js
/**
 * @template {DataTableRow} [Row=DataTableRow]
 */
```

For multiple generics, use a single `@generics` tag with comma-separated names:

```js
/**
 * @generics {Row extends DataTableRow = DataTableRow, Header extends DataTableRow = DataTableRow} Row,Header
 */
```

### `@component` comments

The Svelte Language Server supports component-level comments through the following syntax: `<!-- @component [comment] -->`.

`sveld` copies these over to the exported default component in the TypeScript definition.

**Example:**

```svelte
<!-- @component
@example
<Button>
  Text
</Button>
-->
<script>
  let { children } = $props();
</script>

<button>
  {@render children?.()}
</button>
```

<details>
<summary>Svelte 3/4 (legacy) syntax</summary>

```svelte
<!-- @component
@example
<Button>
  Text
</Button>
-->
<button>
  <slot />
</button>
```

</details>

Output is identical for both syntax modes.

Output:

```ts
/**
 * @example
 * <Button>
 *   Text
 * </Button>
 */
export default class Button extends SvelteComponentTyped<
  ButtonProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
```

### Accessor Props

Exported functions and consts become accessor props in generated TypeScript definitions. Use `@type` for function signatures, or `@param` and `@returns` (or `@return`) for richer docs.

`@type` wins over `@param`/`@returns` when both are present.

**Signature:**

```js
/**
 * Function description
 * @param {Type} paramName - Parameter description
 * @param {Type} [optionalParam] - Optional parameter
 * @returns {ReturnType} Return value description
 */
```

**Example:**

```svelte
<script>
  /**
   * @typedef {object} NotificationData
   * @property {string} [id] - Optional id for deduplication
   * @property {"error" | "info" | "success"} [kind]
   */

  let { children } = $props();

  /**
   * Add a notification to the queue.
   * @param {NotificationData} notification
   * @returns {string} The notification id
   */
  export function add(notification) {
    const id = notification.id ?? "id";
    return id;
  }

  /**
   * Remove a notification by id.
   * @param {string} id
   * @returns {boolean} True if the notification was found and removed
   */
  export function remove(id) {
    return true;
  }

  /**
   * Get notification count.
   * @returns {number} The number of notifications
   */
  export function getCount() {
    return 0;
  }
</script>

<div>
  {@render children?.()}
</div>
```

<details>
<summary>Svelte 3/4 (legacy) syntax</summary>

```svelte
<script>
  /**
   * @typedef {object} NotificationData
   * @property {string} [id] - Optional id for deduplication
   * @property {"error" | "info" | "success"} [kind]
   */

  /**
   * Add a notification to the queue.
   * @param {NotificationData} notification
   * @returns {string} The notification id
   */
  export function add(notification) {
    const id = notification.id ?? "id";
    return id;
  }

  /**
   * Remove a notification by id.
   * @param {string} id
   * @returns {boolean} True if the notification was found and removed
   */
  export function remove(id) {
    return true;
  }

  /**
   * Get notification count.
   * @returns {number} The number of notifications
   */
  export function getCount() {
    return 0;
  }
</script>
```

</details>

Output is identical for both syntax modes.

Output:

```ts
export type NotificationData = {
  /** Optional id for deduplication */
  id?: string;
  kind?: "error" | "info" | "success";
};

export type ComponentProps = Record<string, never>;

export default class Component extends SvelteComponentTyped<
  ComponentProps,
  Record<string, any>,
  Record<string, never>
> {
  /**
   * Add a notification to the queue.
   */
  add: (notification: NotificationData) => string;

  /**
   * Remove a notification by id.
   */
  remove: (id: string) => boolean;

  /**
   * Get notification count.
   */
  getCount: () => number;
}
```

When only `@param` tags are present without `@returns`, the return type defaults to `any`. When only `@returns` is present without `@param`, the function signature is `() => returnType`.

## Troubleshooting

**A prop came out `any`.** Enable [`reportDiagnostics`](#type-inference-diagnostics) (or `strict` to fail CI) to see which props sveld couldn't infer, then tighten them with `@type` or a native TypeScript annotation.

**Generated types don't appear for consumers.** Check that the `types` folder is listed in `exports` and `files` in `package.json`. See [Publishing to NPM](#publishing-to-npm).

**Output differs in CI.** Commit `COMPONENT_API.json` and run [`--check`](#ci-api-drift-checks---check) in CI so API drift fails the build instead of silently diverging.

## Contributing

See [contributing guidelines](CONTRIBUTING.md).

## License

[Apache-2.0](LICENSE)

[npm]: https://img.shields.io/npm/v/sveld.svg?color=262626&style=for-the-badge
[npm-url]: https://npmjs.com/package/sveld
