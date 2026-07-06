# Contributing

`sveld` statically analyzes Svelte components and generates TypeScript definitions (`.d.ts`), JSON (`COMPONENT_API.json`), and Markdown documentation. It parses each component once with the Svelte 5 compiler and walks the resulting AST; that single path powers output for Svelte 3, Svelte 4, Svelte 5 without runes, and Svelte 5 Runes. The public API surface is in [README.md](README.md) (JSDoc tags, options, output shapes) — that file is the source of truth for _what_ sveld supports. This file covers _how the code is built and changed_.

If you're not sure what to build or how to approach a change, [file an issue](https://github.com/carbon-design-system/sveld/issues) before opening a PR.

## Prerequisites

- [Bun](https://bun.sh/docs/installation). The pinned version lives in [`.bun-version`](.bun-version); CI reads it.

Bun is the package manager, test runner, and bundler. There is no separate Node toolchain for development. Run package scripts with `bun <script>` and one-off binaries with `bunx <bin>`.

## Project set-up

Fork the repo and clone your fork:

```sh
git clone <YOUR_FORK>
cd sveld
```

Set the original repository as the upstream:

```sh
git remote add upstream git@github.com:carbon-design-system/sveld.git
# verify that the upstream is added
git remote -v
```

Install dependencies:

```sh
bun install
```

## Scripts

| Script | What it does |
| --- | --- |
| `bun test` | Unit and fixture snapshot tests (`bun test --parallel`). |
| `bun run build` | Bundle `src/index.ts` to `lib/` and emit `.d.ts`. Add `-w` / `--watch` for watch mode. |
| `bun run typecheck` | `tsc --noEmit` over `src/` and `tests/`. |
| `bun run test:fixtures-types` | Type-check the generated fixture outputs (`tests/fixtures/**`). |
| `bun run test:e2e` | Link sveld into the downstream packages under `tests/e2e/` and build each. |
| `bunx biome check --write <paths>` | Lint and format. Scope to what you changed. |
| `bun run lint` / `bun run format` | Biome lint / format across the repo. |

Scope test and lint runs to what you touched. The full suite and a repo-wide `biome` pass are slow and surface unrelated noise.

## How sveld works

The pipeline, end to end:

1. **Resolve the entry point.** [`get-svelte-entry.ts`](src/get-svelte-entry.ts) takes an explicit entry or falls back to `package.json#svelte`.
2. **Parse exports.** [`parse-exports.ts`](src/parse-exports.ts) reads the barrel (for example `src/index.js`) to learn which components are public and under what names; [`create-exports.ts`](src/create-exports.ts) builds the export map. With `glob: true`, every `.svelte` file under the entry directory is discovered instead.
3. **Parse each component.** [`ComponentParser.ts`](src/ComponentParser.ts) is the core. It compiles the component with `svelte/compiler`, walks the ESTree AST with `estree-walker`, and reads JSDoc with `comment-parser` to extract props, events, slots, typedefs, generics, contexts, and rest props into a `ParsedComponent`.
4. **Write output.** The `writer/` modules turn `ParsedComponent` into artifacts:
   - [`writer-ts-definitions.ts`](src/writer/writer-ts-definitions.ts) + [`writer-ts-definitions-core.ts`](src/writer/writer-ts-definitions-core.ts) → `.d.ts` extending `SvelteComponentTyped`.
   - [`writer-json.ts`](src/writer/writer-json.ts) → `COMPONENT_API.json` (carries a `schemaVersion`).
   - [`writer-markdown.ts`](src/writer/writer-markdown.ts) and the `WriterMarkdown` / `MarkdownWriterBase` / `markdown-*-utils` modules → Markdown.
   - [`Writer.ts`](src/writer/Writer.ts) wraps Prettier to format emitted source.

Orchestration and entry surfaces:

- [`plugin.ts`](src/plugin.ts) is the Vite plugin and holds `PluginSveldOptions`, `generateBundle`, and `writeOutput`. The plugin, the programmatic [`sveld.ts`](src/sveld.ts), and the [`cli.ts`](src/cli.ts) all funnel into `generateBundle` → `writeOutput`.
- [`index.ts`](src/index.ts) is the public export barrel: the default Vite plugin, `sveld`, `cli`, and `ComponentParser`.

Supporting modules: [`ast-guards.ts`](src/ast-guards.ts) (ESTree node type guards), [`element-tag-map.ts`](src/element-tag-map.ts) (HTML element → attribute/event maps for forwarded events and `$$restProps`), [`resolve-alias.ts`](src/resolve-alias.ts) (tsconfig/jsconfig path aliases), [`brands.ts`](src/brands.ts) and [`path.ts`](src/path.ts) (path types and normalization), [`validate.ts`](src/validate.ts) (`package.json` parsing).

`ComponentParser.ts` is ~5.8k lines and does the heavy lifting; most feature work and bug fixes land there or in a writer. When a change spans both, the parser produces the metadata and the writer decides how it renders.

## Conventions

Biome enforces most of this in CI (`biome ci --error-on-warnings`); the rest is by convention across `src/`. Config: [`biome.json`](biome.json) — 120-column lines, space indent, multiline attributes.

- **No `any`.** `noExplicitAny` is an error. Prefer `unknown` and narrow with a guard from [`ast-guards.ts`](src/ast-guards.ts). Add a guard there rather than casting inline; the parser leans on these to keep AST handling type-safe.
- **Hoist regexes to module scope.** `useTopLevelRegex` is an error — a regex literal inside a function fails lint. Declare it as a named top-level `const` with a comment describing what it matches, as `ComponentParser.ts` does with `VAR_DECLARATION_REGEX` and friends.
- **Normalize paths; never compare raw separators.** CI runs on Windows, macOS, and Linux. Route paths through [`normalizeSeparators`](src/path.ts) and the branded helpers in [`brands.ts`](src/brands.ts) (`asNormalizedPath`, `asRelativeSourcePath`, `asSvelteEntryPoint`). The brands are compile-time tags that keep a normalized path from being confused with a raw one — keep a value branded once it's normalized instead of re-deriving it. Tests that touch file paths normalize separators too (see [`fixtures.test.ts`](tests/fixtures.test.ts)).
- **Use `node:` import specifiers.** `useNodejsImportProtocol` is an error: `import { join } from "node:path"`, not `"path"`.
- **No barrel re-exports, namespace imports, or import cycles.** `noReExportAll`, `noNamespaceImport`, and `noImportCycles` are errors. Export named bindings explicitly (see [`index.ts`](src/index.ts)).
- **No `await` inside loops and no `Array#forEach`.** `noAwaitInLoops` and `noForEach` are errors. Build the work and `await Promise.all(...)`, or use a `for...of` with the awaits hoisted; use `for...of` / `map` instead of `forEach`.
- **ESM only in `src/`.** `noCommonJs` is an error. The lone exception is [`cli.js`](cli.js), the published bin shim, which is overridden in `biome.json`.
- **No parameter reassignment, no implicit booleans, default params last.** `noParameterAssign`, `noImplicitBoolean`, `useDefaultParameterLast`.
- Document non-obvious parser and build logic with a short comment explaining _why_ (see the bundling notes in [`scripts/build.ts`](scripts/build.ts) and the regex docblocks in `ComponentParser.ts`). Skip comments that restate the code.

Fixtures (`tests/fixtures/**`) and the downstream e2e projects (`tests/e2e/**`) run under relaxed lint rules on purpose — they intentionally contain odd or invalid component code to exercise the parser. Don't "fix" their lint warnings.

## Testing

Tests use the Bun test runner. They live in `tests/`, mostly one `*.test.ts` per `src/` module, plus the fixture and e2e harnesses below.

```sh
bun test                    # everything
bun test ComponentParser    # filter by file-path substring
bun test tests/path.test.ts # a single file
```

### Fixture snapshot tests

This is the primary way parser and writer behavior is pinned. Each directory under `tests/fixtures/` is one case:

```
tests/fixtures/<case-name>/
  input.svelte    # the component to parse (you write this)
  output.json     # parsed metadata (generated)
  output.d.ts     # emitted TypeScript definition (generated)
```

[`fixtures.test.ts`](tests/fixtures.test.ts) globs every `input.svelte`, parses it, and snapshots both the JSON metadata and the formatted `.d.ts` into [`tests/__snapshots__/fixtures.test.ts.snap`](tests/__snapshots__). It also writes `output.json` and `output.d.ts` next to the input so you can read the result directly and assert types against it. The directory name becomes the `moduleName` (kebab-case → PascalCase: `runes-props-basic` → `RunesPropsBasic`).

**To add a case:** create `tests/fixtures/<case-name>/input.svelte` and run `bun test fixtures`. [`bunfig.toml`](bunfig.toml) sets `updateSnapshots = "missing"`, so a brand-new snapshot is written automatically; an existing one that _changes_ fails the test. The committed `output.json` / `output.d.ts` are part of the change — review them, and confirm the `.d.ts` is what a consumer should see.

**When you change the parser or a writer,** expect existing snapshots to move. Inspect every diff before regenerating; a snapshot change is a behavior change. Regenerate intentionally with `bun test --update-snapshots`, never as a reflex.

Name cases after the behavior under test, grouping by feature prefix to match the existing layout (`runes-*`, `context-*`, `typedef-*`, `slot-*`, `forwarded-events-*`, `dispatched-events-*`). Add a focused case per behavior rather than overloading one fixture. Cover the syntax modes a change touches — there are parallel `legacy-*` and `runes-*` families because the same feature must work in both.

### JSON schema

[`schema/component-api.schema.json`](schema/component-api.schema.json) is the published JSON Schema for `COMPONENT_API.json`, and [`component-api-schema.test.ts`](tests/component-api-schema.test.ts) asserts the schema and real output stay in lockstep. **When you add or rename a field on a prop/slot/event/typedef/context** (for example a new `typeSource` value or a prop metadata field), update the schema and that test in the same change.

### Type checks

- `bun run typecheck` — `tsc --noEmit` over `src/` and `tests/`.
- `bun run test:fixtures-types` — type-checks the generated fixture outputs through [`tsconfig.fixtures.json`](tsconfig.fixtures.json), so a `.d.ts` that compiles in isolation but is wrong as a type is caught.

### End-to-end tests

[`tests/test-e2e.ts`](tests/test-e2e.ts) (`bun run test:e2e`) `bun link`s the locally built sveld into each project under `tests/e2e/`, installs, and runs that project's `build`. These are real downstream consumers — `single-export`, `multi-export`, `glob`, `path-aliases`, `sveltekit`, `svelte5-legacy`, `svelte5-runes`, and a large `carbon` fixture mirroring carbon-components-svelte. A failure means generated types don't compile in a real project. Build sveld first (`bun run build`) so the link resolves the current code. CI does not run the e2e suite; run it locally when changing output shape or export resolution.

### Svelte version coverage

A change to props, events, slots, or context handling should be exercised across the modes it affects: legacy `export let` / `<slot>` / `$$restProps`, and runes `$props()` / `$bindable()` / `{@render}` / snippets / callback props. The fixture families and the `svelte5-legacy` vs `svelte5-runes` e2e projects exist to keep both paths honest.

## Build

[`scripts/build.ts`](scripts/build.ts) (`bun run build`) removes `lib/`, bundles `src/index.ts` with `Bun.build` (minified ESM, Node target), then runs `tsc --project tsconfig.build.json` to emit declarations. Dependencies are bundled into `lib/` _except_ `prettier` (kept external — it uses `createRequire` for its data files). `lib/` is gitignored and is never committed. `bun run build -w` rebuilds on changes under `src/`.

The published binary is [`cli.js`](cli.js), which dynamically imports the built `lib/index.js` and calls `cli`.

## Playground

[`playground/`](playground) is a standalone Vite + Svelte app that runs sveld in the browser to preview generated output. It has its own `package.json` and dependencies:

```sh
cd playground
bun install
bun dev
```

It imports the parser and writers from `../src` directly while pinning its own copies of `comment-parser` and `estree-walker` (see [`playground/vite.config.ts`](playground/vite.config.ts)), so source edits show up without a build step.

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every PR across Ubuntu, Windows, and macOS:

1. Install dependencies
2. `biome ci --error-on-warnings`
3. `bun run build`
4. `bun run test`
5. `bun run test:fixtures-types`

Run those locally before pushing. The cross-platform matrix is why path normalization is non-negotiable — a separator bug passes on macOS and fails on Windows.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

- Common types: `fix`, `feat`, `docs`, `chore`, `test`, `refactor`.
- Scope is the area touched: `writer`, `parser`, `playground`, `deps-dev`, or a feature like `template`.
- Append `!` after the scope for breaking changes.
- Imperative mood, one concise line; move detail to the body, referencing issues with `Fixes #N`.

Examples (from the log):

```
fix(writer): parameterize context type for multiple `@template`s
chore(playground): replace `code-mirror` with `HighlightEditable`
chore(deps-dev): replace @typescript/native-preview with typescript@rc
```

## Submit a pull request

Sync your fork with upstream first:

```sh
git fetch upstream
git checkout main
git merge upstream/main
```

Push your branch and open a PR comparing your feature branch to `origin/main`. Keep PRs focused, and include the regenerated fixture outputs and any schema updates your change requires.

## Maintainer guide

The following applies only to maintainers.

### Release

[`publish-to-npm.yml`](.github/workflows/publish-to-npm.yml) publishes to NPM with [provenance](https://docs.npmjs.com/generating-provenance-statements) when a tag starting with `v` is pushed. It installs, runs `bun run build`, prunes with `bunx culls`, and runs `npm publish --provenance --access public`.

To cut a release, bump the version in `package.json`, update [`CHANGELOG.md`](CHANGELOG.md), commit with the version as the message, tag, and push the tag:

```sh
git commit -am "v0.32.9"
git tag v0.32.9
git push origin v0.32.9
```

A successful workflow publishes the new version to NPM.
