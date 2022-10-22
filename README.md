# sveld

[![NPM][npm]][npm-url]
![GitHub](https://img.shields.io/github/license/carbon-design-system/sveld?color=262626&style=for-the-badge)
![npm downloads to date](https://img.shields.io/npm/dt/sveld?color=262626&style=for-the-badge)

`sveld` generates TypeScript definitions for Svelte components by statically analyzing their props, events, slots and more. Prop types and signatures can be defined using [JSDoc notation](https://jsdoc.app/). This documentation generator can also emit component documentation in Markdown and JSON output formats.

The purpose of this project is to make third party Svelte component libraries compatible with the Svelte Language Server and TypeScript with minimal effort required by the author. For example, TypeScript definitions may be used during development via intelligent code completion in Integrated Development Environments (IDE) like VSCode.

[Carbon Components Svelte](https://github.com/IBM/carbon-components-svelte) uses this library to auto-generate component types and API metadata:

- [TypeScript definitions](https://github.com/IBM/carbon-components-svelte/blob/master/types): Component TypeScript definitions
- [Component Index](https://github.com/IBM/carbon-components-svelte/blob/master/COMPONENT_INDEX.md): Markdown file documenting component props, slots, and events
- [Component API](https://github.com/IBM/carbon-components-svelte/blob/master/docs/src/COMPONENT_API.json): Component API metadata in JSON format

**Please note** that the generated TypeScript definitions require [Svelte version 3.31](https://github.com/sveltejs/svelte/blob/master/CHANGELOG.md#3310) or greater.

---

Given a Svelte component, `sveld` can infer basic prop types to generate TypeScript definitions compatible with the [Svelte Language Server](https://github.com/sveltejs/language-tools):

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

The generated definition extends the official `SvelteComponentTyped` interface exported from Svelte.

**Button.svelte.d.ts**

```ts
/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface ButtonProps extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["button"]> {
  /**
   * @default "button"
   */
  type?: string;

  /**
   * @default false
   */
  primary?: boolean;
}

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
```

Sometimes, inferring prop types is insufficient.

Prop/event/slot types and signatures can be augmented using [JSDoc](https://jsdoc.app/) notations.

```js
/** @type {"button" | "submit" | "reset"} */
export let type = "button";

/**
 * Set to `true` to use the primary variant
 */
export let primary = false;
```

The accompanying JSDoc annotations would generate the following:

```ts
/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface ButtonProps extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["button"]> {
  /**
   * @default "button"
   */
  type?: "button" | "submit" | "reset";

  /**
   * Set to `true` to use the primary variant
   * @default false
   */
  primary?: boolean;
}

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
```

---

## Table of Contents

- [Approach](#approach)
- [Usage](#usage)
  - [Installation](#installation)
  - [Rollup](#rollup)
  - [Node.js](#nodejs)
  - [CLI](#cli)
  - [Publishing to NPM](#publishing-to-npm)
- [Available Options](#available-options)
- [API Reference](#api-reference)
  - [@type](#type)
  - [@typedef](#typedef)
  - [@slot](#slot)
  - [@event](#event)
  - [@restProps](#restprops)
  - [@extends](#extends)
  - [@component comments](#component-comments)
- [Contributing](#contributing)
- [License](#license)

## Approach

`sveld` uses the Svelte compiler to statically analyze Svelte components exported from a library to generate documentation useful to the end user.

Extracted metadata include:

- props
- slots
- forwarded events
- dispatched events
- `$$restProps`

This library adopts a progressively enhanced approach. Any property type that cannot be inferred (e.g., "hello" is a string) falls back to "any" to minimize incorrectly typed properties or signatures. To mitigate this, the library author can add JSDoc annotations to specify types that cannot be reliably inferred. This represents a progressively enhanced approach because JSDocs are comments that can be ignored by the compiler.

The generated TypeScript definitions for a component extends the `SvelteComponentTyped` interface available in svelte version 3.31.

## Usage

### Installation

Install `sveld` as a development dependency.

```sh
yarn add -D sveld
# OR
npm i -D sveld
# OR
pnpm i -D sveld
```

### Rollup

Import and add `sveld` as a plugin to your `rollup.config.js`.

```js
// rollup.config.js
import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import sveld from "sveld";

export default {
  input: "src/index.js",
  output: {
    format: "es",
    file: "lib/index.mjs",
  },
  plugins: [svelte(), resolve(), sveld()],
};
```

When building the library, TypeScript definitions are emitted to the `types` folder by default.

Customize the output folder using the `typesOptions.outDir` option.

The following example emits the output to the `dist` folder:

```diff
sveld({
+  typesOptions: {
+    outDir: 'dist'
+  }
})
```

The [integration](integration) folder contains example set-ups:

- [single-export](integration/single-export): library that exports one component
- [single-export-default-only](integration/single-export-default-only): library that exports one component using the concise `export { default } ...` syntax
- [multi-export](integration/multi-export): multi-component library without JSDoc annotations (types are inferred)
- [multi-export-typed](integration/multi-export-typed): multi-component library with JSDoc annotations
- [multi-export-typed-ts-only](integration/multi-export-typed-ts-only): multi-component library that only generates TS definitions
- [glob](integration/glob): library that uses the glob strategy to collect/analyze \*.svelte files
- [carbon](integration/carbon): full `carbon-components-svelte` example

### CLI

The CLI wraps the Rollup plugin and uses the `"svelte"` field defined in your `package.json` as the entry point.

```sh
npx sveld
```

Append `--json` or `--markdown` flags to generate documentation in JSON/Markdown formats, respectively.

```sh
npx sveld --json --markdown
```

### Node.js

You can also use `sveld` programmatically in Node.js.

If no `input` is specified, `sveld` will infer the entry point based on the `package.json#svelte` field.

```js
const { sveld } = require("sveld");
const pkg = require("./package.json");

sveld({
  input: "./src/index.js",
  glob: true,
  markdown: true,
  markdownOptions: {
    onAppend: (type, document, components) => {
      if (type === "h1")
        document.append("quote", `${components.size} components exported from ${pkg.name}@${pkg.version}.`);
    },
  },
  json: true,
  jsonOptions: {
    outFile: "docs/src/COMPONENT_API.json",
  },
});
```

#### `jsonOptions.outDir`

If `json` is `true`, a `COMPONENT_API.json` file will be generated at the root of your project. This file contains documentation for all components.

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

### Publishing to NPM

TypeScript definitions are outputted to the `types` folder by default. Don't forget to include the folder in your `package.json` when publishing the package to NPM.

```diff
{
  "svelte": "./src/index.js",
  "main": "./lib/index.mjs",
+ "types": "./types/index.d.ts",
  "files": [
    "src",
    "lib",
+   "types",
  ]
}
```

## Available Options

By default, only TypeScript definitions are generated.

To generate documentation in Markdown and JSON formats, set `markdown` and `json` to `true`.

```diff
sveld({
+  markdown: true,
+  json: true,
})
```

## API Reference

### `@type`

Without a `@type` annotation, `sveld` will infer the primitive type for a prop:

```js
export let kind = "primary";
// inferred type: "string"
```

Use the `@type` tag to explicitly document the type. In the following example, the `kind` property has an enumerated (enum) type.

Signature:

```js
/**
 * Optional description
 * @type {Type}
 */
```

Example:

```js
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
```

### `@typedef`

The `@typedef` tag can be used to define a common type that is used multiple times within a component. All typedefs defined in a component will be exported from the generated TypeScript definition file.

Signature:

```js
/**
 * @typedef {Type} TypeName
 */
```

Example:

```js
/**
 * @typedef {string} AuthorName
 * @typedef {{ name?: AuthorName; dob?: string; }} Author
 */

/** @type {Author} */
export let author = {};

/** @type {Author[]} */
export let authors = [];
```

### `@slot`

Use the `@slot` tag for typing component slots. Note that `@slot` is a non-standard JSDoc tag.

Descriptions are optional for named slots. Currently, the default slot cannot have a description.

Signature:

```js
/**
 * @slot {Type} slot-name [slot description]
 */

Omit the `slot-name` to type the default slot.

/**
 * @slot {Type}
 */
```

Example:

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

### `@event`

Use the `@event` tag to type dispatched events. An event name is required and a description optional.

Use `null` as the value if no event detail is provided.

Signature:

```js
/**
 * @event {EventDetail} eventname [event description]
 */
```

Example:

```js
/**
 * @event {{ key: string }} button:key
 * @event {null} key – Fired when `key` changes.
 */

export let key = "";

import { createEventDispatcher } from "svelte";

const dispatch = createEventDispatcher();

$: dispatch("button:key", { key });
$: if (key) dispatch("key");
```

Output:

```ts
export default class Component extends SvelteComponentTyped<
  ComponentProps,
  {
    "button:key": CustomEvent<{ key: string }>;
    /** Fired when `key` changes. */ key: CustomEvent<null>;
  },
  {}
> {}
```

### `@restProps`

`sveld` can pick up inline HTML elements that `$$restProps` is forwarded to. However, it cannot infer the underlying element for instantiated components.

You can use the `@restProps` tag to specify the element tags that `$$restProps` is forwarded to.

Signature:

```js
/**
 * Single element
 * @restProps {tagname}
 *
 * Multiple elements
 * @restProps {tagname-1 | tagname-2 | tagname-3}
 */
```

Example:

```svelte
<script>
  /** @restProps {h1 | button} */
  export let edit = false;

  import Button from "../";
</script>

{#if edit}
  <Button {...$$restProps} />
{:else}
  <h1 {...$$restProps}><slot /></h1>
{/if}
```

### `@extends`

In some cases, a component may be based on another component. The `@extends` tag can be used to extend generated component props.

Signature:

```js
/**
 * @extends {<relative path to component>} ComponentProps
 */
```

Example:

```js
/** @extends {"./Button.svelte"} ButtonProps */

export const secondary = true;

import Button from "./Button.svelte";
```

### `@component` comments

The Svelte Language Server supports component-level comments through the following syntax: `<!-- @component [comment] -->`.

`sveld` will copy these over to the exported default component in the TypeScript definition.

Example:

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

Output:

```ts
/**
 * @example
 * <Button>
 *   Text
 * </Button>
 */
export default class Button extends SvelteComponentTyped<ButtonProps, {}, { default: {} }> {}
```

## Contributing

Refer to the [contributing guidelines](CONTRIBUTING.md).

## License

[Apache-2.0](LICENSE)

[npm]: https://img.shields.io/npm/v/sveld.svg?color=262626&style=for-the-badge
[npm-url]: https://npmjs.com/package/sveld
