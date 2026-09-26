# Output

sveld writes up to three kinds of output from one parse:

- [TypeScript definitions](#typescript-definitions) (`types: true`, the default)
- [JSON](#json-output) (`json: true`)
- [Markdown](#markdown-output) (`markdown: true`)

It also returns the JSON document from `sveld()`, so you can render [custom output](#custom-output). Options for each writer are in [Options](options.md).

## TypeScript definitions

By default sveld writes to `types/` (set `typesOptions.outDir` to change it):

- one `<Name>.svelte.d.ts` per component
- an `index.d.ts` barrel that re-exports every component, mirroring your entry file

`typesOptions.preamble` prepends text to `index.d.ts`, and `typesOptions.indexTypes` also re-exports each component's `Props` type from it. See [`typesOptions`](options.md#typesoptions).

### Formats

`typesOptions.format` (CLI: `--types-format`) picks the shape of each component's `.d.ts`.

**`"class"` (default)** extends `SvelteComponentTyped`, which works for consumers on Svelte 3, 4, and 5. `SvelteComponentTyped` is deprecated in Svelte 5.

```ts
import { SvelteComponentTyped } from "svelte";

export type ButtonProps = {
  /**
   * @default "Click me"
   */
  label?: string;

  onclick?: (event: MouseEvent) => void;
};

export default class Button extends SvelteComponentTyped<ButtonProps, Record<string, any>, Record<string, never>> {}
```

**`"component"`** emits the Svelte 5 `Component` type. Use it if your consumers are on Svelte 5 or later.

```ts
import type { Component } from "svelte";

export type ButtonProps = {
  /**
   * @default "Click me"
   */
  label?: string;

  onclick?: (event: MouseEvent) => void;
};

export type ButtonExports = Record<string, never>;

declare const Button: Component<
  ButtonProps,
  ButtonExports,
  ""
>;
export default Button;
```

`Component`'s three type parameters:

- **Props**: the same `<Name>Props` type as `"class"`. Runes callback props (`onclick`) are regular props.
- **Exports**: the component's [accessor props](jsdoc-tags.md#accessor-props), which are class members under `"class"`.
- **Bindings**: a union of prop names declared with `$bindable(...)` or marked [`@bindable writable`](jsdoc-tags.md#bindable), for example `"value" | "open"`. `""` means none, matching Svelte's convention.

`Component` has no events parameter, and in Svelte 5 a `createEventDispatcher` event or an `on:click` forward only reaches `on:event` listeners. So a component with events, and any generic component, gets a per-component interface instead of `Component<...>`. It keeps `on:event` usage typed (`on:bogus` fails) and lets a generic parameter be inferred at each usage site:

```ts
interface ListComponent {
  new <T extends Item = Item>(
    options: ComponentConstructorOptions<ListProps<T>>
  ): SvelteComponent<ListProps<T>> & ListExports;
  <T extends Item = Item>(
    this: void,
    internals: ComponentInternals,
    props: ListProps<T>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<ListProps<T>>): void;
  } & ListExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const List: ListComponent;
export default List;
```

The `new` signature uses `SvelteComponent` and `ComponentConstructorOptions` because the Svelte language server resolves generic inference for `<List items={...} />` through `new`, not the call signature. `@sveltejs/package` emits the same shape.

### Rest props

When `$$restProps` (or a runes `...rest`) is spread onto an element, the props type is widened with that element's attributes, and a `data-*` index signature lets callers pass arbitrary data attributes:

```ts
type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  // ...
  [key: `data-${string}`]: unknown;
};

export type ButtonProps = Omit<$RestProps, keyof $Props> & $Props;
```

Use [`@restProps`](jsdoc-tags.md#restprops) when the spread target is a component.

### Slots and snippets

Every slot becomes an optional snippet prop, so Svelte 5 consumers can pass `{#snippet}` blocks, and a legacy slot definition, so `let:` syntax keeps working. The default slot is the `children` prop.

```ts
export type CardProps = {
  /** Customize the paragraph text. */
  body?: (this: void, ...args: [{ prop: number }]) => void;

  title?: (this: void) => void;
};

export default class Card extends SvelteComponentTyped<
  CardProps,
  Record<string, any>,
  {
    /** Customize the paragraph text. */
    body: { prop: number };
    title: Record<string, never>;
  }
> {}
```

The `(this: void, ...args: [Props]) => void` signature matches Svelte's `Snippet<T>`: `this: void` rules out a `this` context, and the tuple rejects array types.

### Module-script classes

A class exported from `<script context="module">` (`export class Store {}`, or `class Store {}` then `export { Store }`) is emitted with its public surface: constructor, methods (with overloads), fields, constructor parameter properties, getters/setters, and `static`/`readonly`/`abstract`/optional modifiers. Types come from TypeScript annotations, then JSDoc (`@param`, `@returns`, `@type`, `@template`), and are `any` otherwise. In a JS script, a `this.x = ...` assignment in the constructor declares property `x`.

```ts
export declare class Store<T> {
  constructor(initial: T);

  value: T;

  static create<U>(value: U): Store<U>;

  subscribe(run: (value: T) => void): () => void;
}
```

Private (`#x`, `private`), `protected`, computed-key, and `@internal` members are left out. `extends` and `implements` clauses are kept, and an imported base gets an `import type`. A class that extends something the `.d.ts` can't reference (a non-exported local class, or `mixin(Base)`) is declared without `extends` and raises [`sveld/export-unresolved`](ci.md#diagnostic-codes).

Other module-script exports (`const`, `function`, type declarations, re-exports) are written to the `.d.ts` as well.

### Publishing to npm

Point consumers at the generated types with an `exports` map and include the folder in `files`:

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

The `svelte` condition lets bundlers that understand it resolve straight to source. Keep the top-level `"svelte"` field too for older tooling that reads it directly.

## JSON output

`json: true` writes `COMPONENT_API.json` to the project root (`jsonOptions.outFile` changes the path, `jsonOptions.outDir` writes one `<Name>.api.json` per component instead). `sveld --json --stdout` prints it instead.

### Schema

The JSON Schema ships with the package:

```ts
import schema from "sveld/schema/component-api.schema.json" with { type: "json" };
```

It's also on GitHub ([file](https://github.com/carbon-design-system/sveld/blob/main/schema/component-api.schema.json), [raw](https://raw.githubusercontent.com/carbon-design-system/sveld/main/schema/component-api.schema.json)). The schema's `$id` points at `main`, which tracks the latest release; the copy in your installed `sveld` matches the output it produced.

### Shape

```ts
interface ComponentApiJson {
  schemaVersion: 1;
  generator: { name: "sveld"; version: string; svelteVersion: string };
  total: number;
  components: ComponentDocApi[];
  // Only with `documentExports: true`.
  totalExports?: number;
  exports?: EntryExport[];
}
```

Each component has `moduleName`, `filePath`, `syntaxMode` (`"legacy"` or `"runes"`), `scriptLanguage`, and arrays of `props`, `moduleExports`, `slots`, `events`, and `typedefs`. Optional fields include `generics`, `rest_props`, `extends`, `componentComment`, `contexts`, and the [custom element fields](#custom-element-metadata). The schema is the full reference.

Optional fields are omitted when sveld has nothing reliable to put in them. `events` are sorted for stable output.

### Source ranges

Props, slots, events, typedefs, contexts, and the component itself carry a `source` range (`componentCommentSource` for the component comment) when the parser has a stable position:

```ts
{ start: { line: number; column: number }; end: { line: number; column: number } }
```

`line` is 1-based and `column` is 0-based. Ranges add noticeable size to a large library's JSON; set `jsonOptions.source: false` to leave them out.

### Prop fields

A prop looks like this:

```json
{
  "name": "type",
  "kind": "let",
  "type": "\"button\" | \"submit\" | \"reset\"",
  "typeSource": "jsdoc",
  "value": "\"button\"",
  "defaultValue": { "raw": "\"button\"", "kind": "literal", "value": "button" },
  "isFunction": false,
  "isFunctionDeclaration": false,
  "isRequired": false,
  "constant": false,
  "reactive": false
}
```

- `name` is the public prop name. For a runes alias such as `let { class: className } = $props()`, `localName` holds the local binding.
- `typeSource` says where `type` came from: `"typescript"`, `"jsdoc"`, `"default"` (the initializer), `"inferred"`, or `"unknown"`.
- `value` is the raw default expression. `defaultValue` adds a coarse `kind` and a parsed `value` for JSON-safe literals, arrays, and plain objects. sveld never evaluates code.
- `reactive` is a heuristic: `true` when sveld finds the prop assigned or mutated inside the component, declared with `$bindable(...)`, or used as a `bind:` target. `false` doesn't mean a parent can't `bind:` it.
- `binding` (`"readonly"` or `"writable"`) comes only from [`@bindable`](jsdoc-tags.md#bindable).
- `bindable: true` marks props declared with `$bindable(...)`.
- `deprecated` and `tags` come from [`@deprecated`](jsdoc-tags.md#deprecated) and [`@since`/`@see`/`@example`](jsdoc-tags.md#since-see-example).

Module-script exports use the same shape in `moduleExports`, with `kind` `"re-export"` or `"class"` for those forms. A class has `type: "typeof Store"` and its members under `members`.

## Markdown output

`markdown: true` writes `COMPONENT_INDEX.md` to the project root: a component list, then for each component its typedefs, props, module exports, slots, events, and (when present) CSS parts and CSS custom properties. `markdownOptions.outDir` writes one `<Name>.md` per component plus an index `README.md` instead. `markdownOptions.onAppend` injects extra content. See [`markdownOptions`](options.md#markdownoptions).

Descriptions are rendered into table cells: newlines and tag boundaries become `<br />`, fenced code becomes `<pre><code>`, and `{@link}` becomes a Markdown link. Deprecated names are struck through.

## Entry exports

Most entry barrels export more than components. `documentExports: true` adds the barrel's consts, functions, classes, and types to the JSON (`exports`, `totalExports`) and Markdown (an "Exports" section).

```ts
// src/index.ts
export { default as Button } from "./Button.svelte";
export { VERSION } from "./constants";
export { clamp } from "./utils";
export type { Theme } from "./types";
```

From that barrel, sveld documents `VERSION`, `clamp`, and `Theme`; `Button` goes through the component path. Each entry has `name`, `kind`, `type`, an optional JSDoc `description`, `source` (the declaring module's path), `isTypeOnly`, and optional `deprecated` and `tags`. Type text is copied from source, not resolved with `tsc`.

- Nested barrels are followed: `export { X } from "./dir"`, where `./dir/index.js` re-exports a `.svelte` file, resolves `X` to that component without `--glob`.
- An overloaded function documents the implementation signature (the last declaration).
- An `enum`'s `type` is the literal union of its values (`"A" | "B"`), or the enum name when a value can't be determined.
- A name the barrel exports itself wins over the same name from an `export *`. Two `export *` statements that bring in the same name from different modules make it ambiguous: it's left out, with a [`sveld/export-ambiguous`](ci.md#diagnostic-codes) diagnostic. Export it explicitly to pick one.
- A namespace re-export (`export * as utils from "./utils"`) documents one `const` export `utils` with type `typeof import("./utils.ts")`.
- A re-exported default (`export { default as track } from "./track"`) is documented when it's a function, class, or named binding.

## Custom element metadata

sveld records custom element configuration in the JSON output and the `document` returned by `sveld()`. It doesn't write a [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest), but one can be built from this data.

`<svelte:options customElement="x-foo" />` sets `customElementTag: "x-foo"`. The object form is recorded in full as `customElement` (`tag`, `shadow`, `props`, and `extend: true` when an `extend` function is set):

```svelte
<svelte:options
  customElement={{
    tag: "x-widget",
    shadow: "none",
    props: {
      variant: { attribute: "data-variant" },
      active: { reflect: true },
      tags: { type: "Array" }
    },
    extend: (customElementConstructor) => customElementConstructor
  }}
/>
```

[`@csspart` and `@cssprop`](jsdoc-tags.md#csspart--cssprop) tags become `cssParts` and `cssProperties`. `@cssprop`'s `{type}` and `[--name=default]` are optional, following the [Custom Elements Manifest analyzer](https://custom-elements-manifest.open-wc.org/analyzer/getting-started/#css-custom-properties) grammar. Markdown renders them as two tables.

## Custom output

sveld has no writer plugin API. To produce another format, call `sveld()` and render the `document` it returns. It's the same object `json: true` writes to `COMPONENT_API.json`, and it's populated whether or not `json` is on:

```js
import { writeFile } from "node:fs/promises";
import { sveld } from "sveld";

const { document } = await sveld({ types: false });

const lines = document.components.map(
  (component) => `${component.moduleName}: ${component.props.map((prop) => prop.name).join(", ")}`,
);

await writeFile("components.txt", `${lines.join("\n")}\n`);
```

`buildComponentApiDocument(components)` builds the same document from parsed components, for example from [`sveld/browser`](options.md#browser).
