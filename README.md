# sveld

[![NPM][npm]][npm-url]
![npm downloads to date](https://img.shields.io/npm/dt/sveld?color=262626&style=for-the-badge)

`sveld` generates TypeScript definitions and component documentation (JSON and Markdown) for Svelte component libraries. It statically analyzes props, events, slots, snippets, context, module exports, and rest props, and reads [JSDoc](https://jsdoc.app/) where inference isn't enough.

The generated `.d.ts` files give consumers autocomplete and type checking through the Svelte Language Server and TypeScript, with little effort from the library author. [Carbon Components Svelte](https://github.com/carbon-design-system/carbon-components-svelte) uses sveld to generate its component types and API metadata.

sveld supports Svelte 3, Svelte 4, Svelte 5 without runes (`export let`, `<slot>`, `$$restProps`), and Svelte 5 runes (`$props()`, `$bindable()`, `{@render}`, callback props).

## When to use sveld

If your library is built with SvelteKit's `svelte-package`, it already emits `.d.ts` files through `svelte2tsx`; start there.

sveld is for:

- **JavaScript-first libraries.** Components written in plain JavaScript with JSDoc, where you want full editor types without converting to `lang="ts"`.
- **Docs from the same source as the types.** JSON and Markdown API docs, generated in the same run.
- **API drift checks.** `--check` diffs the component API against a committed snapshot and fails CI on breaking changes.
- **Richer types from JSDoc.** `@typedef`, `@callback`, `@slot`, `@event`, and context types that plain inference can't produce.

`lang="ts"` components work too: sveld keeps their type annotations as written.

## Install

```sh
npm i -D sveld
# or: pnpm i -D sveld / bun i -D sveld / yarn add -D sveld
```

## Quick start

sveld reads the `"svelte"` field of your `package.json` as the entry point: the file that re-exports your components.

```json
{
  "svelte": "./src/index.js"
}
```

### CLI

```sh
npx sveld                     # writes types/*.d.ts
npx sveld --json --markdown   # also writes COMPONENT_API.json and COMPONENT_INDEX.md
```

Run `npx sveld --help` for every flag. Options can also live in a `sveld.config.js`:

```js
// sveld.config.js
import { defineConfig } from "sveld";

export default defineConfig({
  json: true,
  markdown: true,
});
```

### Vite plugin

```ts
// vite.config.ts
import { svelte } from "@sveltejs/vite-plugin-svelte";
import sveld from "sveld";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte(), sveld({ json: true })],
});
```

The plugin runs during `vite build` (and during `vite dev` with `watch: true`). It also works in Rollup configs.

### Node

```js
import { sveld } from "sveld";

const { document, diagnostics, exitCode } = await sveld({
  entry: "./src/index.js",
  json: true,
});
```

`document` is the same component API document `json: true` writes, so you can render your own formats from it. See [Options](docs/options.md) for everything `sveld()` accepts and returns.

## Example

Given this component:

```svelte
<!-- Button.svelte -->
<script>
  export let type = "button";
  export let primary = false;
</script>

<button {...$$restProps} {type} class:primary on:click>
  <slot>Click me</slot>
</button>
```

sveld infers prop types and defaults, the forwarded `click` event, the default slot, and the rest props spread onto `<button>`:

```ts
// types/Button.svelte.d.ts
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

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type ButtonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  { click: WindowEventMap["click"] },
  { default: Record<string, never> }
> {}
```

The default slot is also typed as a `children` snippet prop for Svelte 5 consumers, and the `data-*` index signature lets callers pass data attributes through `$$restProps`.

Add JSDoc to tighten types and add descriptions:

```svelte
<script>
  /** @type {"button" | "submit" | "reset"} */
  export let type = "button";

  /**
   * Set to `true` to use the primary variant
   */
  export let primary = false;
</script>
```

```ts
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

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};
```

The runes version (`let { type = "button", primary = false, children, ...rest } = $props()`, spreading `rest` and rendering `children`) produces the same `$Props`. It has no `click` event, since runes components take `onclick` as a prop through `rest`.

The `.d.ts` extends `SvelteComponentTyped` by default, which works for consumers on Svelte 3, 4, and 5. Set `typesOptions.format: "component"` (`--types-format=component`) to emit the Svelte 5 `Component` type instead. See [Output](docs/output.md#formats).

### JSON and Markdown

`npx sveld --markdown` documents the same component in `COMPONENT_INDEX.md`:

```md
## `Button`

### Props

| Prop name | Required | Kind | Reactive | Binding | Type | Default value | Description |
| :- | :- | :- | :- | :- | :- | :- | :- |
| type | No | <code>let</code> | No | -- | <code>"button" &#124; "submit" &#124; "reset"</code> | <code>"button"</code> | -- |
| primary | No | <code>let</code> | No | -- | <code>boolean</code> | <code>false</code> | Set to `true` to use the primary variant |

### Slots

| Slot name | Default | Props | Fallback | Description |
| :- | :- | :- | :- | :- |
| -- | Yes | <code>Record&lt;string, never> </code> | <code>Click me</code> | -- |

### Events

| Event name | Type | Detail | Description |
| :- | :- | :- | :- |
| click | forwarded | -- | -- |
```

`npx sveld --json` writes the same data to `COMPONENT_API.json`, validated by a [JSON Schema](schema/component-api.schema.json) that ships with the package. An excerpt of the prop entry:

```json
{
  "name": "type",
  "kind": "let",
  "type": "\"button\" | \"submit\" | \"reset\"",
  "typeSource": "jsdoc",
  "value": "\"button\"",
  "isRequired": false,
  "reactive": false
}
```

See [Output](docs/output.md#json-output) for the full shape.

## In CI

Commit `COMPONENT_API.json`, then gate pull requests on API changes and inference gaps:

```sh
npx sveld --check    # exit 3 on a breaking API change against the snapshot
npx sveld --strict   # exit 4 when a prop fell back to `any`, a tag was dropped, ...
```

```
sveld --check: 2 API changes detected against "COMPONENT_API.json".
Suggested semver bump: major.

  Button
    [BREAKING] prop "target" added (required)
    [BREAKING] prop "href" removed
```

See [CI](docs/ci.md) for exit codes, the change classification table, diagnostic codes, and how to ignore a diagnostic.

## JSDoc tags

| Tag | Use it to | Example |
| :- | :- | :- |
| [`@type`](docs/jsdoc-tags.md#type) | Type a prop | `@type {"sm" \| "md" \| "lg"}` |
| [`@default`](docs/jsdoc-tags.md#default) | Override the inferred default shown in docs | `@default () => true` |
| [`@typedef`](docs/jsdoc-tags.md#typedef) | Declare a shared, exported type | `@typedef {{ id: string }} Item` |
| [`@property`](docs/jsdoc-tags.md#property) | Document a field of a `@typedef {object}` or event detail | `@property {string} [label] - Label text` |
| [`@callback`](docs/jsdoc-tags.md#callback) | Declare a function type | `@callback OnChange` + `@param`/`@returns` |
| [`@slot` / `@snippet`](docs/jsdoc-tags.md#slot--snippet) | Type slot or snippet props | `@slot {{ item: Item }} row` |
| [`@event`](docs/jsdoc-tags.md#event) | Type a dispatched event's detail | `@event {{ id: string }} save` |
| [`@param` / `@returns`](docs/jsdoc-tags.md#accessor-props) | Type an exported function | `@param {string} id` |
| [`@restProps`](docs/jsdoc-tags.md#restprops) | Name the element rest props are spread onto | `@restProps {button \| a}` |
| [`@extendProps`](docs/jsdoc-tags.md#extendprops) | Extend another component's props | `@extendProps {"./Button.svelte"} ButtonProps` |
| [`@template` / `@generics`](docs/jsdoc-tags.md#template--generics) | Declare generics in a JS component | `@template {Item} [T=Item]` |
| [`@bindable`](docs/jsdoc-tags.md#bindable) | Document a prop's `bind:` contract | `@bindable writable` |
| [`@deprecated`](docs/jsdoc-tags.md#deprecated) | Mark a prop, event, slot, or export deprecated | `@deprecated Use "size" instead.` |
| [`@ignore` / `@internal`](docs/jsdoc-tags.md#ignore--internal) | Hide from every output | `@internal` |
| [`@since` / `@see` / `@example`](docs/jsdoc-tags.md#since-see-example) | Pass structured tags through to all outputs | `@since 1.2.0` |
| [`{@link}`](docs/jsdoc-tags.md#link) | Link in a description | `{@link https://example.com\|docs}` |
| [`@csspart` / `@cssprop`](docs/jsdoc-tags.md#csspart--cssprop) | Document shadow-DOM styling hooks | `@cssprop {Color} [--bg=white]` |
| [`@sveld-ignore`](docs/ci.md#ignoring-diagnostics) | Suppress a diagnostic | `@sveld-ignore sveld/prop-unknown-type` |
| [`<!-- @component -->`](docs/jsdoc-tags.md#component-comments) | Document the component itself | `<!-- @component Renders a button. -->` |

Context types come from `setContext` calls with no tag needed. See [Context](docs/jsdoc-tags.md#context).

## Docs

- [Options](docs/options.md): every option and CLI flag, the config file, the Vite plugin, `sveld()` and its result, and `sveld/browser`.
- [JSDoc tags](docs/jsdoc-tags.md): how types are inferred and every tag sveld reads.
- [Output](docs/output.md): `.d.ts` formats, JSON output and schema, Markdown, entry exports, custom element metadata, and custom output formats.
- [CI](docs/ci.md): exit codes, `--check` for API drift, `--strict` and diagnostic codes, and `@example` checking.
- [Troubleshooting](docs/troubleshooting.md)

Try sveld in the browser at [sveld.onrender.com](https://sveld.onrender.com) (source in [`playground/`](playground)).

## Requirements

- Node 22 or later, or Bun. sveld is ESM-only.
- A `sveld.config.ts` needs a runtime that strips TypeScript: Bun, or Node 22.18+ / 23.6+.
- The optional [`checkExamples`](docs/ci.md#checking-example-blocks) check for TS/JS examples needs `typescript` 7+ and a `tsconfig.json`. Nothing else loads TypeScript.
- Your installed Svelte version doesn't affect parsing. sveld parses with [sveast](https://github.com/metonym/sveast), kept in parity with `svelte/compiler`.

## Contributing

See the [contributing guidelines](CONTRIBUTING.md).

## License

[Apache-2.0](LICENSE)

[npm]: https://img.shields.io/npm/v/sveld.svg?color=262626&style=for-the-badge
[npm-url]: https://npmjs.com/package/sveld
