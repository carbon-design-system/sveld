# sveld

[![NPM][npm]][npm-url]
![GitHub](https://img.shields.io/github/license/carbon-design-system/sveld?color=262626&style=for-the-badge)
![npm downloads to date](https://img.shields.io/npm/dt/sveld?color=262626&style=for-the-badge)

`sveld` is a TypeScript definition generator for Svelte components. It analyzes props, events, slots, and other component features through static analysis. Types and signatures can be defined using [JSDoc notation](https://jsdoc.app/). The tool can also generate component documentation in Markdown and JSON formats.

The purpose of this project is to make third party Svelte component libraries compatible with the Svelte Language Server and TypeScript with minimal effort required by the author. For example, TypeScript definitions may be used during development via intelligent code completion in Integrated Development Environments (IDE) like VSCode.

[Carbon Components Svelte](https://github.com/IBM/carbon-components-svelte) uses this library to auto-generate component types and API metadata:

- [TypeScript definitions](https://github.com/IBM/carbon-components-svelte/blob/master/types): Component TypeScript definitions
- [Component Index](https://github.com/IBM/carbon-components-svelte/blob/master/COMPONENT_INDEX.md): Markdown file documenting component props, slots, and events
- [Component API](https://github.com/IBM/carbon-components-svelte/blob/master/docs/src/COMPONENT_API.json): Component API metadata in JSON format

**Please note** that the generated TypeScript definitions require Svelte version 3.55 or greater.

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

  [key: `data-${string}`]: any;
};

export type ButtonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  { click: WindowEventMap["click"] },
  { default: Record<string, never> }
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
  - [Context API](#context-api)
  - [@restProps](#restprops)
  - [@extends](#extends)
  - [@generics](#generics)
  - [@component comments](#component-comments)
  - [Accessor Props](#accessor-props)
- [Contributing](#contributing)
- [License](#license)

## Approach

`sveld` uses the Svelte compiler to statically analyze Svelte components exported from a library to generate documentation useful to the end user.

Extracted metadata include:

- props
- slots
- forwarded events
- dispatched events
- context (setContext/getContext)
- `$$restProps`

This library adopts a progressively enhanced approach. Any property type that cannot be inferred (e.g., "hello" is a string) falls back to "any" to minimize incorrectly typed properties or signatures. To mitigate this, the library author can add JSDoc annotations to specify types that cannot be reliably inferred. This represents a progressively enhanced approach because JSDocs are comments that can be ignored by the compiler.

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

By default, `sveld` will use the `"svelte"` field from your `package.json` to determine the entry point. You can override this by specifying an explicit `entry` option:

```js
sveld({
  entry: "src/index.js",
})
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

The [tests/e2e](tests/e2e) folder contains example set-ups:

- [single-export](tests/e2e/single-export): library that exports one component
- [single-export-default-only](tests/e2e/single-export-default-only): library that exports one component using the concise `export { default } ...` syntax
- [multi-export](tests/e2e/multi-export): multi-component library without JSDoc annotations (types are inferred)
- [multi-export-typed](tests/e2e/multi-export-typed): multi-component library with JSDoc annotations
- [multi-export-typed-ts-only](tests/e2e/multi-export-typed-ts-only): multi-component library that only generates TS definitions
- [glob](tests/e2e/glob): library that uses the glob strategy to collect/analyze \*.svelte files
- [carbon](tests/e2e/carbon): full `carbon-components-svelte` example

### CLI

The CLI uses the `"svelte"` field from your `package.json` as the entry point:

```sh
npx sveld
```

Generate documentation in JSON and/or Markdown formats using the following flags:

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

### Rollup Plugin Options

- **`entry`** (string, optional): Specify the entry point to uncompiled Svelte source. If not provided, sveld will use the `"svelte"` field from `package.json`.
- **`glob`** (boolean, optional): Enable glob mode to analyze all `*.svelte` files.
- **`types`** (boolean, optional, default: `true`): Generate TypeScript definitions.
- **`typesOptions`** (object, optional): Options for TypeScript definition generation.
- **`json`** (boolean, optional): Generate component documentation in JSON format.
- **`jsonOptions`** (object, optional): Options for JSON output.
- **`markdown`** (boolean, optional): Generate component documentation in Markdown format.
- **`markdownOptions`** (object, optional): Options for Markdown output.

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

For template literal default values, `sveld` automatically infers [template literal types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html) when possible:

```js
export let id = `ccs-${Math.random().toString(36)}`;
// inferred type: `ccs-${string}` & {}

export let prefix = `prefix-`;
// inferred type: `prefix-` & {}

export let suffix = `-suffix`;
// inferred type: `-suffix` & {}
```

The `& {}` intersection type makes the template literal type more permissive, allowing regular strings to be assigned while preserving the template literal type for better autocomplete and type hints. This provides more precise type checking than a generic `string` type while remaining flexible. For complex expressions in template literals, the type defaults to `string` for safety.

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

#### Using `@property` for complex typedefs

For complex object types, use the `@property` tag to document individual properties. This provides better documentation and IDE support with per-property tooltips.

Signature:

```js
/**
 * Type description
 * @typedef {object} TypeName
 * @property {Type} propertyName - Property description
 */
```

Example:

```js
/**
 * Represents a user in the system
 * @typedef {object} User
 * @property {string} name - The user's full name
 * @property {string} email - The user's email address
 * @property {number} age - The user's age in years
 */

/** @type {User} */
export let user = { name: "John", email: "john@example.com", age: 30 };
```

Output:

```ts
export type User = {
  /** The user's full name */ name: string;
  /** The user's email address */ email: string;
  /** The user's age in years */ age: number;
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

Following JSDoc standards, use square brackets to mark properties as optional. You can also specify default values using the `[propertyName=defaultValue]` syntax.

Signature:

```js
/**
 * @typedef {object} TypeName
 * @property {Type} [optionalProperty] - Optional property description
 * @property {Type} [propertyWithDefault=defaultValue] - Property with default value
 */
```

Example:

```js
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
```

Output:

```ts
export type ComponentConfig = {
  /** Whether the component is enabled */ enabled: boolean;
  /** The component theme */ theme: string;
  /** Optional timeout in milliseconds @default 5000 */ timeout?: number;
  /** Optional debug mode flag */ debug?: boolean;
};

export type ComponentProps = {
  /**
   * Configuration options for the component
   * @default { enabled: true, theme: "dark" }
   */
  config?: ComponentConfig;
};
```

> **Note:** The inline syntax `@typedef {{ name: string }} User` continues to work for backwards compatibility.

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
 * Optional event description
 * @event {EventDetail} eventname [inline description]
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
  Record<string, never>
> {}
```

#### Using `@property` for complex event details

For events with complex object payloads, use the `@property` tag to document individual properties. The main comment description will be used as the event description.

Signature:

```js
/**
 * Event description
 * @event eventname
 * @type {object}
 * @property {Type} propertyName - Property description
 */
```

Example:

```js
/**
 * Fired when the user submits the form
 *
 * @event submit
 * @type {object}
 * @property {string} name - The user's name
 * @property {string} email - The user's email address
 * @property {boolean} newsletter - Whether the user opted into the newsletter
 */

import { createEventDispatcher } from "svelte";

const dispatch = createEventDispatcher();

function handleSubmit() {
  dispatch("submit", {
    name: "Jane Doe",
    email: "jane@example.com",
    newsletter: true
  });
}
```

Output:

```ts
export default class Component extends SvelteComponentTyped<
  ComponentProps,
  {
    /** Fired when the user submits the form */
    submit: CustomEvent<{
      /** The user's name */ name: string;
      /** The user's email address */ email: string;
      /** Whether the user opted into the newsletter */ newsletter: boolean;
    }>;
  },
  Record<string, never>
> {}
```

#### Optional properties in event details

Just like with typedefs, you can mark event detail properties as optional using square brackets. This is useful when some properties may not always be included in the event payload.

Example:

```js
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

import { createEventDispatcher } from "svelte";

const dispatch = createEventDispatcher();

function throwSnowball() {
  dispatch("snowball", {
    isPacked: true,
    speed: 50
  });
}
```

Output:

```ts
export default class Component extends SvelteComponentTyped<
  ComponentProps,
  {
    /** Snowball event fired when throwing a snowball */
    snowball: CustomEvent<{
      /** Indicates whether the snowball is tightly packed */ isPacked: boolean;
      /** The speed of the snowball in mph */ speed: number;
      /** Optional color of the snowball */ color?: string;
      /** Optional density with default value @default 0.9 */ density?: number;
    }>;
  },
  Record<string, never>
> {}
```

### Context API

`sveld` automatically generates TypeScript definitions for Svelte's `setContext`/`getContext` API by extracting types from JSDoc annotations on the context values.

#### How it works

When you use `setContext` in a component, `sveld` will:

1. Detect the `setContext` call
2. Extract the context key (must be a string literal)
3. Find JSDoc `@type` annotations on the variables being passed
4. Generate a TypeScript type export for the context

#### Example

**Modal.svelte**

```svelte
<script>
  import { setContext } from 'svelte';

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

  setContext('simple-modal', { open, close });
</script>

<div class="modal">
  <slot />
</div>
```

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

  // Fully typed with autocomplete!
  const { close, open } = getContext<SimpleModalContext>('simple-modal');
</script>

<button on:click={close}>Close</button>
```

#### Explicitly typing contexts

There are several ways to provide type information for contexts:

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

> **Note:** For best results, use explicit JSDoc `@type` annotations. Inline functions without annotations will be inferred with generic signatures.

#### Notes

- Context keys must be string literals (dynamic keys are not supported)
- Variables passed to `setContext` should have JSDoc `@type` annotations for accurate types
- The generated type name follows the pattern: `{PascalCase}Context`
  - `"simple-modal"` → `SimpleModalContext`
  - `"Tabs"` → `TabsContext`
- If no type annotation is found, the type defaults to `any` with a warning

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

### `@generics`

Currently, to define generics for a Svelte component, you must use [`generics` attribute](https://github.com/dummdidumm/rfcs/blob/bfb14dc56a70ec6ddafebf2242b8e1500e06a032/text/ts-typing-props-slots-events.md#generics) on the script tag. Note that this feature is [experimental](https://svelte.dev/docs/typescript#experimental-advanced-typings) and may change in the future.

However, the `generics` attribute only works if using `lang="ts"`; the language server will produce an error if `generics` is used without specifying `lang="ts"`.

```svelte
<!-- This causes an error because `lang="ts"` must be used. -->
<script generics="Row extends DataTableRow = any"></script>
```

Because `sveld` is designed to support JavaScript-only usage as a baseline, the API design to specify generics uses a custom JSDoc tag `@generics`.

Signature:

```js
/**
 * @generics {GenericParameter} GenericName
 */
```

Example

```js
/**
 * @generics {Row extends DataTableRow = any} Row
 */
```

The generated TypeScript definition will resemble the following:

```ts
export default class Component<Row extends DataTableRow = any> extends SvelteComponentTyped<
  ComponentProps<Row>,
  Record<string, any>,
  Record<string, any>
> {}
```

For a parameter list, the name should be comma-separated but not include spaces.

```js
/**
 * @generics {Param1, Param2} Name1,Name2
 */
```

```ts
export default class Component<Param1, Param2> extends SvelteComponentTyped<
  ComponentProps<Name1, Name2>,
  Record<string, any>,
  Record<string, any>
> {}
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
export default class Button extends SvelteComponentTyped<
  ButtonProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
```

### Accessor Props

Exported functions and consts become accessor props in generated TypeScript definitions. Use `@type` to document function signatures, or use `@param` and `@returns` (or `@return`) JSDoc tags for richer documentation.

Note that `@type` tag annotations take precedence over `@param`/`@returns` tags.

Signature:

```js
/**
 * Function description
 * @param {Type} paramName - Parameter description
 * @param {Type} [optionalParam] - Optional parameter
 * @returns {ReturnType} Return value description
 */
```

Example:

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

Output:

```ts
export type NotificationData = {
  /** Optional id for deduplication */ id?: string;
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

## Contributing

Refer to the [contributing guidelines](CONTRIBUTING.md).

## License

[Apache-2.0](LICENSE)

[npm]: https://img.shields.io/npm/v/sveld.svg?color=262626&style=for-the-badge
[npm-url]: https://npmjs.com/package/sveld
