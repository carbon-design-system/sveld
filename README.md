# sveld

[![NPM][npm]][npm-url]
[![Build][build]][build-badge]

`sveld` generates TypeScript definitions for Svelte components by statically analyzing components for props, events, slots and more. Prop types and signatures can be augmented using JSDoc notation. This library can also emit component documentation in Markdown and JSON output formats.

The purpose of this project is to make third party Svelte components and libraries compatible with the Svelte Language Server and TypeScript with minimal effort by the author. For example, TypeScript definitions may be used during development via intelligent code completion in Integrated Development Environments (IDE) like VSCode.

[Carbon Components Svelte](https://github.com/IBM/carbon-components-svelte) uses this library to auto-generate component types and API metadata:

- **[TypeScript definitions](https://github.com/IBM/carbon-components-svelte/blob/master/types)**: Component TypeScript definitions
- **[Component Index](https://github.com/IBM/carbon-components-svelte/blob/master/COMPONENT_INDEX.md)**: Markdown file documenting component props, slots, and events
- **[Component API](https://github.com/IBM/carbon-components-svelte/blob/master/docs/src/COMPONENT_API.json)**: Component API metadata in JSON format

**Please note** that the generated TS definitions require [Svelte version 3.31](https://github.com/sveltejs/svelte/blob/master/CHANGELOG.md#3300) or greater.

---

Given a Svelte component, sveld can infer basic prop types to generate TypeScript definitions compatible with the [Svelte Language Server](https://github.com/sveltejs/language-tools):

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

export default class Button extends SvelteComponentTyped<ButtonProps, { click: WindowEventMap["click"] }, { default: {} }> {}
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

export default class Button extends SvelteComponentTyped<ButtonProps, { click: WindowEventMap["click"] }, { default: {} }> {}
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
- [API](#api)
- [Contributing](#contributing)
- [License](#license)

## Approach

sveld uses the Svelte compiler to statically analyze all Svelte components exported from a library to generate documentation that is useful for the end user.

Extracted metadata:

- exported props
- slots
- forwarded events
- dispatched events
- `$$restProps`

This library adopts a progressively enhanced approach. Any property type that cannot be inferred (e.g. "hello" is a string) falls back to "any" to minimize incorrectly typed properties or signatures. To mitigate this, the library author can add JSDoc annotations to specify types that cannot be reliably inferred. This represents a progressively enhanced approach because JSDocs are comments that can be ignored by the compiler.

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
- [multi-export](multi-export): multi-component library without JSDoc annotations (types are inferred)
- [multi-export-typed](multi-export-typed): multi-component library with JSDoc annotations

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

## API

The parsed component API resembles the following:

```ts
interface ParsedComponent {
  props: Array<{
    name: string;
    kind: "let" | "const" | "function";
    constant: boolean;
    type?: string;
    value?: any;
    description?: string;
    isFunction: boolean;
    reactive: boolean;
  }>;
  slots: Array<{
    name?: string;
    default: boolean;
    fallback?: string;
    slot_props?: string;
  }>;
  events: Array<ForwardedEvent | DispatchedEvent>;
  typedefs: Array<{
    type: string;
    name: string;
    description?: string;
    ts: string;
  }>;
  rest_props?: {
    type: "InlineComponent" | "Element";
    name: string;
  };
}

interface ForwardedEvent {
  type: "forwarded";
  name: string;
  element: {
    type: "InlineComponent" | "Element";
    name: string;
  };
}

interface DispatchedEvent {
  type: "dispatched";
  name: string;
  detail?: any;
}
```

## Contributing

Refer to the [contributing guidelines](CONTRIBUTING.md).

## License

[Apache-2.0](LICENSE)

[npm]: https://img.shields.io/npm/v/sveld.svg?color=262626&style=for-the-badge
[npm-url]: https://npmjs.com/package/sveld
[build]: https://img.shields.io/travis/com/ibm/sveld?color=24a148&style=for-the-badge
[build-badge]: https://travis-ci.com/ibm/sveld
