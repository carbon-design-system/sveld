# CI

sveld has two CI gates: `--check` fails on API changes against a committed snapshot, and `--strict` fails on diagnostics (types that fell back to `any`, tags with nothing to attach to, broken `@example` code). They're independent and can run together.

- [Exit codes](#exit-codes)
- [API drift checks (`--check`)](#api-drift-checks---check)
- [Diagnostics](#diagnostics)
- [Diagnostic codes](#diagnostic-codes)
- [Ignoring diagnostics](#ignoring-diagnostics)
- [Checking `@example` blocks](#checking-example-blocks)
- [Machine-readable output](#machine-readable-output)

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Usage or configuration error: unknown flag, bad flag value, unresolvable entry, unresolved re-export or path alias, missing or outdated `--check` snapshot |
| `2` | Generation failure: a component failed to parse, or an unrecoverable error. Without `--fail-fast`, the other components' output is still written. |
| `3` | Breaking API change found by `--check` |
| `4` | Diagnostics present under `--strict` |

When more than one applies, each failure is still reported and the process exits with the lowest code. `sveld()` returns the same code as `exitCode` without setting `process.exitCode`.

## API drift checks (`--check`)

`--check` diffs the parsed API against a committed `COMPONENT_API.json`, assigns a semver bump to each change, and exits `3` on a breaking one.

1. Generate and commit the snapshot: `npx sveld --json`, then commit `COMPONENT_API.json`.
2. Run `npx sveld --check` in CI.

```
sveld --check: 2 API changes detected against "COMPONENT_API.json".
Suggested semver bump: major.

  Button
    [BREAKING] prop "target" added (required)
    [BREAKING] prop "href" removed
```

| Change | Bump |
| --- | --- |
| Component added | `minor` |
| Component removed | `major` |
| Prop/export added (optional) | `minor` |
| Prop/export added (required) | `major` |
| Prop/export removed | `major` |
| Prop/export became required | `major` |
| Prop/export became optional | `minor` |
| Prop/export type widened (union gained a member) | `minor` |
| Prop/export type narrowed (union lost a member) | `major` |
| Prop/export type changed (anything else) | `major` |
| Function-typed prop/export gained a trailing optional param | `minor` |
| Function-typed prop/export lost a param, or return type changed | `major` |
| Prop gained a writable binding (`bind:`-able) | `minor` |
| Prop lost a writable binding | `major` |
| Prop/export default value changed (type unchanged) | `patch` |
| `@deprecated` added | `minor` |
| `@deprecated` removed | `patch` |
| `constant`/`reactive` flag flipped | `minor` |
| Event/slot added | `minor` |
| Event/slot removed | `major` |
| Event detail / slot props type widened | `minor` |
| Event detail / slot props type narrowed or otherwise changed | `major` |
| `generics`, `@restProps`, `@extends`, or context shape changed | `major` (not classified further) |
| Description-only change | not reported |

Marking a public member [`@internal`](jsdoc-tags.md#ignore--internal) counts as removing it.

- `--check` never writes the snapshot. To update it, run `sveld --json` (or `sveld --json --check`) and commit the file.
- A missing snapshot exits `1`, so a mistyped path can't pass CI. The exception is `sveld --json --check`, which writes it in the same run, prints a notice, and exits `0`.
- `--check=<path>` diffs against another file. The default is `jsonOptions.outFile`, or `COMPONENT_API.json`.
- Only `major` changes fail by default. `--check-level=minor` or `--check-level=patch` lowers the threshold; lower changes are always reported.
- A snapshot with a different `schemaVersion` isn't diffed. `--check` reports a `kind: "schema"` change and exits `1`; regenerate the snapshot with `sveld --json`.

From Node, pass `check: true` (or a path). The result is on `SveldResult.check`, and `formatCheckReport(check)` renders the text above. See [Node API](options.md#node-api).

## Diagnostics

sveld collects diagnostics on every run: props that fall back to `any`, context values typed `any`, `@event` tags with nothing dispatching them, syntax sveld can't model, and more. They're always in `SveldResult.diagnostics`, each with a `code`, `severity`, `component`, `message`, and a `source` range when sveld has a stable position.

Nothing is printed by default. `--report-diagnostics` (`reportDiagnostics: true`) prints a grouped summary to `stderr`:

```
sveld: 2 diagnostics (0 errors, 2 warnings).

Props without inferred types (1):
  ./Button.svelte
    - Prop "title" type could not be inferred; falling back to "any". (./Button.svelte:22:2) [sveld/prop-unknown-type]

@event tags with no dispatch or callback (1):
  ./Button.svelte
    - @event "save" has no matching dispatch or callback prop. (./Button.svelte:9:5) [sveld/event-no-source]
```

`--strict` (`strict: true`) prints the same summary and exits `4` when any diagnostic remains. `--strict=errors` (`strict: "errors"`) fails only on `error`-severity diagnostics and lets warnings through.

```sh
npx sveld --json --strict
npx sveld --json --strict=errors
```

Severities: `error` means sveld emitted broken or incomplete output (a syntax it skipped, a type that didn't parse, a missing `@extendProps` target). `warning` means a type fell back to `any` or something was left out of the docs.

## Diagnostic codes

Codes are stable, so use them (not `message`) in config and scripts.

| Code | Severity | Fix |
| --- | --- | --- |
| `sveld/prop-unknown-type` | `warning` | Add a TypeScript annotation, a `@type` tag, or an initializer sveld can infer a type from. |
| `sveld/context-any-type` | `warning` | Annotate the `setContext` value's declaration with `@type` or a TypeScript type. |
| `sveld/slot-missing-type` | `warning` | Add the `{Type}` to the `@slot`/`@snippet` tag (e.g. `@slot {{}} name`). Until then it's `Record<string, never>`. |
| `sveld/event-no-source` | `warning` | Dispatch the event, forward it (`on:name`), or add a matching `on<name>` callback prop. Otherwise remove the stale `@event` tag. |
| `sveld/dispatch-escapes` | `warning` | The dispatcher is passed somewhere sveld can't follow (a package import, a local function, a computed event name, or passed on again). Document its events with `@event`, then add `@sveld-ignore sveld/dispatch-escapes` to the dispatcher's JSDoc. |
| `sveld/example-compile-error` | `error` | Fix the `@example` TS/JS block so it type-checks, or remove it. |
| `sveld/example-syntax-error` | `error` | Fix the `@example` `svelte`/`html` markup so it parses, or remove it. |
| `sveld/syntax-skipped` | `error` | Rewrite the flagged syntax in a form sveld can model. The message says what was skipped. |
| `sveld/type-syntax-error` | `error` | Fix the JSDoc `{type}` so it parses as TypeScript: close the bracket, drop the trailing `\|`, turn a `//` comment into `/* */` (it would comment out the rest of the `.d.ts` line), or rewrite closure syntax (`{?string}` as `{string \| null}`, `{Array.<string>}` as `{string[]}`). Until then it's `any`. |
| `sveld/rest-props-unresolved` | `warning` | Spread rest props onto a plain element (or `svelte:element`), or add `@restProps`. |
| `sveld/context-duplicate-key` | `warning` | Remove the duplicate `setContext` call or give it a distinct key. Only the first call's shape is used. |
| `sveld/context-key-unresolved` | `warning` | Use a string literal, a `const` string, `Symbol()`, or an `export const` from a relative module as the key. Otherwise the context is left out. |
| `sveld/context-value-unresolved` | `warning` | Pass an object literal or a typed variable as the value. Otherwise the context is left out. |
| `sveld/spread-unresolved` | `warning` | Spread a local object literal or a variable with a resolvable type. Otherwise the type widens to `Record<string, any>`. |
| `sveld/export-unresolved` | `warning` | Export a local declaration directly. Move re-exports and classes into `<script context="module">`, where sveld writes them to the `.d.ts`. |
| `sveld/module-export-conflict` | `warning` | Rename the module-script export. `default` always collides with the component, and a name matching `<Name>Props`/`<Name>Exports` breaks the `.d.ts`. |
| `sveld/extend-props-target-missing` | `error` | Point `@extendProps` at a file that exists, and for a `.svelte` target, name its `<Name>Props` type exactly. |
| `sveld/extend-props-duplicate` | `warning` | Remove the extra `@extendProps` tag. Only the last one is used. |
| `sveld/extend-props-override` | `warning` | Rename the prop, or accept that it overrides the target's prop of the same name. |
| `sveld/jsdoc-unknown-tag` | `warning` | Fix the tag name if it's a typo (`@depreacted`). Otherwise no action needed; the tag passes through. |
| `sveld/typedef-duplicate` | `warning` | Rename one of the `@typedef`/`@callback` declarations. Only the later one is kept. |
| `sveld/property-duplicate` | `warning` | Remove the duplicate `@property`. Only the later one is kept. |
| `sveld/generics-conflict` | `warning` | Give each `@generics`/`@template` declaration a distinct name. |
| `sveld/event-description-ambiguous` | `warning` | Put the description above its `@event` tag, indent it as a continuation, or give each event its own comment block. |
| `sveld/jsdoc-tag-dropped` | `warning` | Move the tag next to a `@slot`/`@snippet`/`@event`/`@typedef`/`@callback` in the same block so it has something to attach to. |
| `sveld/internal-typedef-referenced` | `error` | Remove `@internal` from the typedef, or stop referencing it from public types. |
| `sveld/cross-file-unresolved` | `warning` | Only from [`sveld/browser`](options.md#browser)'s standalone parse: an imported value needs the imported file. Run the full build, or inline the value. |
| `sveld/export-ambiguous` | `warning` | Two `export *` statements in the entry barrel bring in the same name, so it's not exported. Export it explicitly from the barrel. Only with `documentExports`. |

The list is also exported as `DIAGNOSTIC_CODES`.

## Ignoring diagnostics

An ignored diagnostic never fails `--strict`. It stays in `SveldResult.diagnostics` with `ignored: true`, is left out of the printed summary, and is tallied in its header: `sveld: 1 diagnostic (0 errors, 1 warning) (1 ignored).`

**Config matchers.** `diagnostics.ignore` takes `{ code?, component?, name? }` objects. Every field you set must match; an omitted field matches anything. `component` is a glob (`*` within a path segment, `**` across segments).

```js
// sveld.config.js
export default defineConfig({
  diagnostics: {
    ignore: [
      // Every prop-unknown-type diagnostic under legacy/.
      { code: "sveld/prop-unknown-type", component: "./legacy/**" },
      // One named symbol, anywhere.
      { name: "internalOnly" },
    ],
  },
});
```

**Inline.** `@sveld-ignore <code>` in the JSDoc of the prop, `@event` tag, context variable, or event dispatcher it applies to. A bare `@sveld-ignore` suppresses every diagnostic for that symbol.

```svelte
<script>
  /**
   * @sveld-ignore sveld/prop-unknown-type
   */
  export let value;
</script>
```

## Checking `@example` blocks

`@example` blocks are plain text, so a renamed prop can leave them broken unnoticed. `checkExamples: true` (`--check-examples`) checks them:

- `js`/`ts`/`jsx`/`tsx` fences, untagged fences, and unfenced code run through the TypeScript program and report `sveld/example-compile-error`. This catches renamed or removed symbols and wrong argument counts. It's not a full type check.
- `svelte`/`html` fences are parsed with sveld's template parser ([sveast](https://github.com/metonym/sveast)) and report `sveld/example-syntax-error` for malformed markup (a mismatched closing tag, an unterminated attribute). Props and expression types aren't checked; use `svelte-check` in your own tests for that.
- Unfenced markup (a body starting with `<`) and other fence languages are skipped.

```
@example blocks that failed to compile (1):
  ./Component.svelte
    - Line 1: Cannot find name 'formatValue'. [sveld/example-compile-error]
```

The TS/JS check needs `typescript` 7+ (for `typescript/unstable/async`) and a `tsconfig.json`. If either is missing, the run fails instead of skipping examples: `sveld()` throws and the CLI exits `2`. `checkExamples: "syntax"` (`--check-examples=syntax`) runs only the markup check and never loads TypeScript.

Both are `error` severity, so `--strict` or `--strict=errors` fails CI on a broken example.

## Machine-readable output

`--format=json` switches the `--check` report (on `stdout`) and the diagnostics summary (on `stderr`) to JSON:

```sh
sveld --check --format=json | jq '.bump'
sveld --check --format=json | jq '.changes[] | select(.bump == "major")'
```

```json
{
  "kind": "check-report",
  "schemaVersion": 1,
  "snapshotExists": true,
  "snapshotFile": "COMPONENT_API.json",
  "changes": [
    { "component": "Button", "kind": "prop", "name": "target", "bump": "major", "message": "prop \"target\" added (required)" }
  ],
  "bump": "major"
}
```

The diagnostics envelope is `{ "kind": "diagnostics", "schemaVersion": 1, "diagnostics": [...] }` and includes ignored diagnostics with `ignored: true`. Each envelope has its own `schemaVersion`, separate from `COMPONENT_API.json`'s.
