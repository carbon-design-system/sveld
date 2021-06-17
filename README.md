# sveld

[![NPM][npm]][npm-url]
[![Build][build]][build-badge]

`sveld` generates TypeScript definitions for Svelte components by statically analyzing their props, events, slots and more. Prop types and signatures can be defined using [JSDoc notation](https://jsdoc.app/). This documentation generator can also emit component documentation in Markdown and JSON output formats.

The purpose of this project is to make third party Svelte component libraries compatible with the Svelte Language Server and TypeScript with minimal effort required by the author. For example, TypeScript definitions may be used during development via intelligent code completion in Integrated Development Environments (IDE) like VSCode.

[Carbon Components Svelte](https://github.com/IBM/carbon-components-svelte) uses this library to auto-generate component types and API metadata:

- [TypeScript definitions](https://github.com/IBM/carbon-components-svelte/blob/master/types): Component TypeScript definitions
- [Component Index](https://github.com/IBM/carbon-components-svelte/blob/master/COMPONENT_INDEX.md): Markdown file documenting component props, slots, and events
- [Component API](https://github.com/IBM/carbon-components-svelte/blob/master/docs/src/COMPONENT_API.json): Component API metadata in JSON format

**Please note** that the generated TypeScript definitions require [Svelte version 3.31](https://github.com/sveltejs/svelte/blob/master/CHANGELOG.md#3300) or greater.

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

**Button.d.ts**

```ts
/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

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
  - [Set-up with Rollup](#set-up-with-rollup)
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
- [Contributing](#contributing)
- [License](#license)

## Approach

sveld uses the Svelte compiler to statically analyze all Svelte components exported from a library to generate documentation that is useful for the end user.

Extracted metadata:

- props
- slots
- forwarded events
- dispatched events
- `$$restProps`

This library adopts a progressively enhanced approach. Any property type that cannot be inferred (e.g. "hello" is a string) falls back to "any" to minimize incorrectly typed properties or signatures. To mitigate this, the library author can add JSDoc annotations to specify types that cannot be reliably inferred. This represents a progressively enhanced approach because JSDocs are comments that can be ignored by the compiler.

The generated TypeScript definitions for a component extends the `SvelteComponentTyped` interface available in svelte version 3.31.

## Usage

### Installation

Install `sveld` as a development dependency.

```sh
yarn add -D sveld
# OR
npm i -D sveld
```

### Set-up with Rollup

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

When building the library with Rollup, TypeScript definitions will be written to the `types` folder.

The [integration](integration) folder contains example set-ups:

- [single-export](integration/single-export): library that exports one component
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

### Publishing to NPM

Specify the entry point for the TypeScript definitions in your `package.json`.

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

Without a `@type` annotation, sveld will infer the primitive type for a prop:

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

Use the `@slot` tag for typing component slots.

Signature:

```js
/**
 * @slot {Type} [slot name]
 */
```

Example:

```svelte
<script>
  /**
   * @slot {{ prop: number; doubled: number; }}
   * @slot {{ props: { class?: string; } }} description
   */

  export let prop = 0;
</script>

<h1>
  <slot {prop} doubled={prop * 2} />
</h1>

<p>
  <slot name="description" props={{ class: $$props.class }} />
</p>
```

### `@event`

Use the `@event` tag for typing dispatched events. An event name must be specified.

Signature:

```js
/**
 * @event {EventDetail} eventname
 */
```

Example:

```js
/**
 * @event {{ key: string }} button:key
 */

export let key = "";

import { createEventDispatcher } from "svelte";

const dispatch = createEventDispatcher();

$: dispatch("button:key", { key });
```

### `@restProps`

sveld can pick up inline HTML elements that `$$restProps` is forwarded to. However, it cannot infer the underlying element for instantiated components.

You can use the `@restProps` tag to explicitly define element tags that `$$restProps` is forwarded to.

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
/** @extends {"./Button"} ButtonProps */

export const secondary = true;

import Button from "./Button.svelte";
```

## Contributing

Refer to the [contributing guidelines](CONTRIBUTING.md).

## License

[Apache-2.0](LICENSE)

[npm]: https://img.shields.io/npm/v/sveld.svg?color=262626&style=for-the-badge
[npm-url]: https://npmjs.com/package/sveld
[build]: https://img.shields.io/travis/com/ibm/sveld?color=24a148&style=for-the-badge
[build-badge]: https://travis-ci.com/ibm/sveld
