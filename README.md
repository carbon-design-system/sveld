# sveld

> Documentation generator for Svelte component libraries.

`sveld` is a Rollup plugin that generates TypeScript definitions for Svelte component libraries. It can also generate component documentation in Markdown and JSON output formats. Component documentation (e.g. prop types, descriptions, slot signatures) can be augmented through JSDoc annotations, a markup language for JavaScript code.

The purpose of this project is to enhance the end user experience of consuming third party Svelte components and libraries with minimal documentation effort required by the author. For example, TypeScript definitions may be used during development via intelligent code completion in Integrated Development Environments (IDE) like VSCode.

The core of this library is extracted from [carbon-components-svelte](https://github.com/IBM/carbon-components-svelte).

---

Say that you have a basic Button component:

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

sveld can statically analyze the component and infer basic prop types to generate TypeScript definitions compatible with the [Svelte Language Server](https://github.com/sveltejs/language-tools):

```ts
// Button.d.ts
/// <reference types="svelte" />

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

export default class Button {
  $$prop_def: ButtonProps;
  $$slot_def: {
    default: {};
  };

  $on(eventname: "click", cb: (event: WindowEventMap["click"]) => void): () => void;
  $on(eventname: string, cb: (event: Event) => void): () => void;
}
```

Sometimes, inferred prop types are not enough.

You can augment the definitions using [JSDoc](https://jsdoc.app/) annotations.

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
// Button.d.ts
/// <reference types="svelte" />

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

export default class Button {
  $$prop_def: ButtonProps;
  $$slot_def: {
    default: {};
  };

  $on(eventname: "click", cb: (event: WindowEventMap["click"]) => void): () => void;
  $on(eventname: string, cb: (event: Event) => void): () => void;
}
```

---

## Table of Contents

- [Approach](#approach)
- [Usage](#usage)
  - [Installation](#installation)
  - [Set-up with Rollup](#set-up-with-rollup)
  - [Publishing to NPM](#publishing-to-npm)
- [Available Options](#available-options)
- [API](#api)
- [Contributing](#contributing)
- [License](#license)

## Approach

sveld uses the Svelte compiler to statically analyze all Svelte components exported from a library to generate documentation that is useful for the end user.

Extracted component documentation:

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
  input: "src/index.js", // the input file must be named `index.js`
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
