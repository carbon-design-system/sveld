# JSDoc tags

sveld infers what it can from component source. JSDoc tags fill in the rest: prop types, event details, slot props, shared types, and documentation metadata.

A JSDoc block documents the declaration below it. Blank lines and ordinary comments may sit between the two, such as a `// biome-ignore ...` or `/* istanbul ignore next */` line.

Examples show Svelte 5 runes syntax first, with the Svelte 3/4 (legacy) form in a collapsed block where it differs. Unless noted, both produce the same output.

- [How prop types are resolved](#how-prop-types-are-resolved)
- [`@type`](#type)
- [`@default`](#default)
- [`@typedef`](#typedef)
- [`@property`](#property)
- [`@callback`](#callback)
- [`@slot` / `@snippet`](#slot--snippet)
- [`@event`](#event)
- [Accessor props (exported functions)](#accessor-props)
- [Context (`setContext`)](#context)
- [`@restProps`](#restprops)
- [`@extendProps`](#extendprops)
- [`@template` / `@generics`](#template--generics)
- [`@component` comments](#component-comments)
- [`@bindable`](#bindable)
- [`@deprecated`](#deprecated)
- [`@ignore` / `@internal`](#ignore--internal)
- [`@since`, `@see`, `@example`](#since-see-example)
- [`{@link}`](#link)
- [`@csspart` / `@cssprop`](#csspart--cssprop)
- [`@sveld-ignore`](#sveld-ignore)

## How prop types are resolved

When both TypeScript syntax and JSDoc are present, sveld picks a prop's type in this order:

1. explicit TypeScript annotation
2. explicit JSDoc annotation (`@type`)
3. inference from the initializer
4. `any`

When inference fails, a prop falls back to `any` rather than a wrong guess, and sveld records a [`sveld/prop-unknown-type`](ci.md#diagnostic-codes) diagnostic. A prop with no annotation, no `@type`, and no initializer is typed `any` with no `@default` line, and its JSON `typeSource` is `"unknown"`.

For `lang="ts"` components, sveld keeps source-level type annotations: legacy `export let` props, typed `$props()` destructuring (whole-object and per-prop), local `interface`/`type`/`enum` declarations, and TypeScript signatures on exported functions. A type that an annotation depends on is re-emitted as an `import type` at the top of the generated `.d.ts` (whether the source used `import type` or a plain import used only as a type), and local declarations it depends on are copied alongside it. Everything stays textual: sveld does not run the TypeScript compiler, and `satisfies`/`as` are treated alike. So an imported type used for a whole `$props()` object is kept in the `.d.ts` but isn't expanded into per-prop JSON metadata. A `const enum` is widened to a literal union of its member values, since common bundlers don't support `const enum` under `isolatedModules`.

## `@type`

Without `@type`, sveld infers a primitive type from the initializer. A template literal default infers `string`.

```js
export let kind = "primary"; // string
export let id = `ccs-${Math.random().toString(36)}`; // string
```

Use `@type` to be precise. In `lang="ts"` components, prefer native annotations; `@type` is for JavaScript components and for overriding an inferred type.

```js
/**
 * Optional description
 * @type {Type}
 */
```

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

For runes components with several destructured props, put JSDoc on each property. A declaration-level block is a fallback when the destructure exposes a single public prop.

A declaration-level `@type` naming an object `@typedef` (or an inline `{ ... }` type) types the whole `$props()` object instead, the form Svelte's docs recommend for JavaScript components. Each prop takes its type, optionality, and description from the matching member:

```svelte
<script>
  /**
   * @typedef {object} Props
   * @property {string} title Card title
   * @property {boolean} [elevated=false] Raise the card
   */

  /** @type {Props} */
  let { title, elevated = false } = $props();
</script>
```

Type text is copied verbatim, so any TypeScript type works: unions, intersections, utility types (`Pick`, `Omit`, `ReturnType`, ...), type predicates (`(value: unknown) => value is User`), and `unknown`/`any`. A JSDoc `{type}` that doesn't parse as TypeScript raises [`sveld/type-syntax-error`](ci.md#diagnostic-codes) and falls back to `any`. Rewrite closure-style syntax: `{?string}` as `{string | null}`, `{Array.<string>}` as `{string[]}`.

### Importing types

TypeScript's [`import(...)` type syntax](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html#import-types) works in `@type` and `@typedef`, with no top-level `import` needed. The expression is copied verbatim into the `.d.ts`:

- `import("module").Type` references an exported type.
- `typeof import("module").value` references the type of an exported value.

```svelte
<script>
  /** @type {import("svelte/store").Writable<string>} */
  export let value;

  /** @type {typeof import("svelte/store").writable} */
  export let createStore;
</script>
```

```ts
export type ComponentProps = {
  value: import("svelte/store").Writable<string>;
  createStore: typeof import("svelte/store").writable;
};
```

## `@default`

sveld infers the default from the prop's initializer and writes it as a `@default` line in the `.d.ts`:

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

A fallback or conditional initializer (`??`, `||`, `&&`, `?:`) shows its source text, folded onto one line, in the `.d.ts`, the JSON `value`, and the Markdown "Default value" column. For example, `export let size = defaultSize ?? "md"` documents `@default defaultSize ?? "md"`.

An explicit `@default` always wins over the inferred value. Use it when the initializer names something meaningless to consumers:

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

### Identifier resolution

When the initializer is a variable, sveld resolves it to the value, following up to 5 levels of `const` indirection. Beyond that, the last identifier name is used.

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

An imported name, or a member of a namespace import (`timing.TOOLTIP_LEAVE_DELAY_MS`), resolves when the imported module (followed through re-exports) declares it as an `export const` with a string, number, boolean, or static template literal. This needs the whole library build (CLI, `sveld()`, or the Vite plugin), not a single-file parse.

```svelte
<script>
  // timing.js: export const TOOLTIP_LEAVE_DELAY_MS = 300;
  import { TOOLTIP_LEAVE_DELAY_MS } from "./timing.js";

  export let leaveDelayMs = TOOLTIP_LEAVE_DELAY_MS;
</script>
```

```ts
/**
 * @default 300
 */
leaveDelayMs?: number;
```

Any other identifier (an `export let`, a computed value, a package import) is used as-is, and its type falls back to `any`.

## `@typedef`

`@typedef` defines a shared type. Every typedef in a component is exported from its generated `.d.ts`.

```js
/**
 * @typedef {Type} TypeName
 */
```

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

An object-literal typedef is emitted as an `interface`. A union (for example a discriminated union, `{ kind: "a"; ... } | { kind: "b"; ... }`) is emitted as a `type` alias so it narrows correctly for consumers.

### Documenting fields with `@property`

Use `@typedef {object}` with `@property` tags to give each field its own description, which shows up in IDE tooltips. Square brackets mark a field optional, and `[name=value]` documents its default.

```svelte
<script>
  /**
   * Represents a user in the system
   * @typedef {object} User
   * @property {string} name - The user's full name
   * @property {number} [age=30] - The user's age in years
   */

  /** @type {User} */
  export let user = { name: "John" };
</script>
```

```ts
/**
 * Represents a user in the system
 */
export type User = {
  /** The user's full name */
  name: string;
  /** The user's age in years @default 30 */
  age?: number;
};

export type ComponentProps = {
  /**
   * Represents a user in the system
   * @default { name: "John" }
   */
  user?: User;
};
```

## `@property`

`@property` documents one field of an object. sveld reads it in two places only:

| Context | Behavior |
| :- | :- |
| After `@typedef {object} Name`, in the same block | Builds `Name`'s fields. See [`@typedef`](#documenting-fields-with-property). |
| After `@event name`, in the same block | Builds the event's detail type. See [`@event`](#event-details-with-property). |
| On a plain prop | Not structured. Folded into the prop's description as literal text. |
| Before a `@slot` / `@snippet` line | Dropped. |
| Inside `@callback` | Not read. Use `@param`. |

A description can wrap onto continuation lines, which run until the next tag. Indent them past the `*` gutter to keep them attached to the tag. An unindented line right above an `@event`/`@typedef`/`@slot` with no description of its own is read as that tag's description instead, and an unindented line after an event's last `@property` describes the event. A blank line between indented paragraphs is kept as a paragraph break.

```js
/**
 * @typedef {object} Config
 * @property {number} itemHeight Height of each item in pixels, used for
 *   virtualization math.
 */
```

A `{type}` can wrap too. The text after its closing `}` and the name is the tag's description.

## `@callback`

`@callback` defines a function type with `@param` and `@returns`, following the [TypeScript JSDoc `@callback` syntax](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html#callback). Callbacks are exported from the `.d.ts` like typedefs.

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

```ts
/**
 * Callback fired when the value changes
 */
export type OnChange = (value: string, index: number) => void;

export type ComponentProps = {
  /**
   * Callback fired when the value changes
   * @default (value, index) => {}
   */
  onChange?: OnChange;
};
```

Without `@returns`, the return type is `void`. Without `@param` tags, the callback takes no arguments. A `@callback` can share a comment block with `@typedef` tags.

## `@slot` / `@snippet`

`@slot` types a component slot. `@snippet` is an alias for Svelte 5 components. Omit the name to type the default slot.

```js
/**
 * @slot {Type} [slot-name] [description]
 * @snippet {Type} [snippet-name] [description]
 */
```

`{Type}` is required. Without it, the slot falls back to `Record<string, never>` and sveld raises [`sveld/slot-missing-type`](ci.md#diagnostic-codes).

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

Each slot becomes both a snippet prop and a legacy slot definition in the `.d.ts`, so consumers can use either `{#snippet}` or `let:` syntax. See [Slots and snippets](output.md#slots-and-snippets).

In runes components, `{@render ...}` calls are mapped back into the same slot metadata as `<slot>`. Positional snippet calls such as `{@render row?.(item, index)}` stay typed props when the prop has an explicit type like `Snippet<[Item, number]>`.

`{Type}` is the snippet's one argument. For positional parameters, use a tuple type instead. It becomes the parameter list, and the snippet gets no legacy slot definition, since a slot takes one props object:

```svelte
<script>
  /**
   * @snippet {[item: string, index: number]} row - One row per item.
   */
  let { row } = $props();
</script>

{#each items as item, index}
  {@render row?.(item, index)}
{/each}
```

```ts
/** One row per item. */
row?: (this: void, ...args: [item: string, index: number]) => void;
```

A snippet that takes one tuple argument needs it wrapped: `@snippet {[[number, string]]} pair`.

When `$props()` has a TypeScript annotation, the `.d.ts` keeps that annotation, and `@snippet` only documents the slot in JSON and Markdown.

A `@slot` / `@snippet` tag with no matching `<slot name>` or `{@render}` in the component raises [`sveld/slot-not-rendered`](ci.md#diagnostic-codes). In runes components, a declared snippet prop also counts, since it may be passed on to a child.

### Describing the default slot

The slot name and description are both optional, so the first word after `{Type}` is read as the name: `@slot {{}} Page content` documents a slot named `Page`. To describe the default slot inline, put `-` where the name goes:

```js
/**
 * @slot {{}} - Page content rendered after the header.
 */
```

Or put the description on the line above the tag:

```js
/**
 * Page content rendered after the header.
 * @slot {{}}
 */
```

`default` also names the default slot (`@slot {{}} default - Page content`), as does `children` on `@snippet`.

### Description and extra tags

Put the slot's description, then any extra tags, then the `@slot` / `@snippet` line last. Tags such as `@example`, `@see`, and `@since` before the slot line are copied to the `.d.ts`, JSON (`tags`), and Markdown. `@deprecated` in that position marks the slot deprecated. Tags after `@slot` in the same comment are not tied to that slot.

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

## `@event`

`@event` types a dispatched event. The name is required; the detail type and description are optional. Use `null` for an event with no detail.

```js
/**
 * Optional event description
 * @event {EventDetail} eventname [inline description]
 */
```

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

```ts
export default class Component extends SvelteComponentTyped<
  ComponentProps,
  {
    "button:key": CustomEvent<{ key: string }>;
    /** Fired when `key` changes. */
    key: CustomEvent<null>;
  },
  Record<string, never>
> {}
```

In runes components, callback props like `onclick` are props, not events. If a runes component documents `@event foo` and has a matching `onfoo` callback prop without dispatching or forwarding `foo`, sveld attaches the documentation to the callback prop. An `@event` with no dispatch, forward, or callback prop raises [`sveld/event-no-source`](ci.md#diagnostic-codes).

### Inferring events without `@event`

sveld infers events from `dispatch("name", detail)` calls and `on:event` forwards. Without an `@event` tag, the detail type comes from the call site:

- A scalar literal narrows to its literal type: `dispatch("count", 5)` gives `5`.
- An object or array literal is typed member by member: `dispatch("save", { id })` gives `{ id: string }` when `id` is a string, and `dispatch("items", [1, 2])` gives `number[]`. Members sveld can't resolve become `any` individually.
- A variable takes its `@type` or TS annotation, or is typed from its initializer the way a prop default is (`let count = $state(0)` is `number`). A variable initialized from a call, a destructured binding without an annotation, or a function parameter is `any`.
- `$host().dispatchEvent(new CustomEvent("name", { detail }))` in a custom element types `detail` the same way.
- `dispatch("reset", {})` gives `Record<string, never>`. A spread or computed key adds a `[key: string]: any` index signature.

When the dispatcher is passed to a function imported from a local module (`helper(dispatch)`, `helper({ dispatch })`, or `helpers.open(dispatch)` through a namespace import), sveld reads that function and picks up the events it dispatches. Event names there must be string literals, or a conditional between them. This needs the whole library build, not a single-file parse.

```js
// dispatch-open-close.js
export function createOpenCloseDispatcher(dispatch) {
  return (open) => dispatch(open ? "open" : "close");
}
```

```svelte
<script>
  import { createEventDispatcher } from "svelte";
  import { createOpenCloseDispatcher } from "./dispatch-open-close.js";

  const dispatch = createEventDispatcher();
  // Types `open` and `close` as `CustomEvent<null>`
  const notifyOpenChange = createOpenCloseDispatcher(dispatch);
</script>
```

When sveld can't follow the dispatcher (a package import, a local function, a computed event name, or a helper that passes the dispatcher on), it reports [`sveld/dispatch-escapes`](ci.md#diagnostic-codes). Document those events with `@event` tags.

### Typed dispatchers

`createEventDispatcher<T>()`'s type argument (in `lang="ts"`, or through a JSDoc `/** @type {import('svelte').EventDispatcher<T>} */` cast) works like an `@event` tag for every member of `T`, including ones never dispatched in the file. `T` may be a local `type` or `interface`. An `@event` tag for the same name overrides the generic's detail type.

```svelte
<script lang="ts">
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher<{ save: { id: string }; cancel: null }>();
</script>
```

### Event details with `@property`

An inline object type such as `@event {{ name: string }} submit` can't carry per-field descriptions. Use `@type {object}` and `@property` tags instead. The main comment becomes the event description, and `[name]` / `[name=value]` mark optional fields.

```svelte
<script>
  /**
   * Fired when the user submits the form
   *
   * @event submit
   * @type {object}
   * @property {string} name - The user's name
   * @property {number} [density=0.9] - Optional density
   */
</script>
```

```ts
{
  /** Fired when the user submits the form */
  submit: CustomEvent<{
    /** The user's name */
    name: string;
    /** Optional density @default 0.9 */
    density?: number;
  }>;
}
```

`@type {object}` with no `@property` tags, or no `@type` at all, also builds the detail from the `@property` entries. Any other explicit `@type` (a union, for example) wins over `@property` tags and is copied verbatim:

```js
/**
 * @event sort
 * @type {{ key: null; direction: "none" } | { key: string; direction: "ascending" | "descending" }}
 * Dispatched when a sortable column header would change the active sort.
 */
```

Free text after the tags describes the event, not a property.

## Accessor props

Exported functions and `const`s in the instance script become accessor members of the component in the `.d.ts`. Type them with `@type`, or with `@param` and `@returns` (or `@return`). `@type` wins when both are present.

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
    return notification.id ?? "id";
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

```ts
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
   * Get notification count.
   */
  getCount: () => number;
}
```

With `@param` but no `@returns`, the return type is `any`. With `@returns` but no `@param`, the signature is `() => ReturnType`. The Markdown writer lists these exports with Kind `accessor` in the Props table.

Under `typesOptions.format: "component"`, accessors are typed as the component's `Exports`. See [Output](output.md#typescript-definitions).

## Context

sveld generates a type for each `setContext(key, value)` call, named `{PascalCase}Context` after the key, so consumers can type `getContext`.

```svelte
<script>
  import { setContext } from "svelte";

  /**
   * Close the modal
   * @type {() => void}
   */
  const close = () => {};

  /**
   * Open the modal with content
   * @type {(component: any, props?: any) => void}
   */
  const open = (component, props) => {};

  setContext("simple-modal", { open, close });
</script>
```

```ts
export type SimpleModalContext = {
  /** Open the modal with content */
  open: (component: any, props?: any) => void;
  /** Close the modal */
  close: () => void;
};
```

Consumers import the type from the component:

```svelte
<script lang="ts">
  import { getContext } from "svelte";
  import type { SimpleModalContext } from "modal-library/Modal.svelte";

  const { close, open } = getContext<SimpleModalContext>("simple-modal");
</script>
```

### Keys

| Key form | Example | Generated type |
| --- | --- | --- |
| String literal | `setContext("simple-modal", …)` | `SimpleModalContext` |
| Static template literal | `` setContext(`simple-modal`, …) `` | `SimpleModalContext` |
| `const`-bound string | `const KEY = "simple-modal";`<br>`setContext(KEY, …)` | `SimpleModalContext` |
| `Symbol()` / `Symbol.for()` | `setContext(Symbol("tabs"), …)` | `TabsContext` |
| Imported `export const` string | `import { KEY } from "./keys.js";`<br>`setContext(KEY, …)` | `SimpleModalContext` |
| Namespace-imported `export const` | `import * as keys from "./keys.js";`<br>`setContext(keys.KEY, …)` | `SimpleModalContext` |

- `const` identifiers are followed up to 5 levels deep. `let`, `var`, and props are skipped because they can change at runtime.
- A symbol takes its name from its description. `const ModalKey = Symbol()` with no description uses the binding name: `ModalKeyContext`.
- An imported key is read from a relative `.js`/`.ts` module (following re-exports) that declares it as an `export const` string or static template literal. This needs the whole library build.
- Characters that can't appear in an identifier are dropped and start a new word, and a leading digit gets a `_`: `"user_settings"` becomes `UserSettingsContext`, `"Carbon.Modal"` becomes `CarbonModalContext`, `"@scope/ctx"` becomes `ScopeCtxContext`, and `"123"` becomes `_123Context`.

Any other key records [`sveld/context-key-unresolved`](ci.md#diagnostic-codes), and no context type is generated.

### Values

The value must be an object literal or a variable. Any other expression (such as `setContext("store", writable(0))`) is skipped with [`sveld/context-value-unresolved`](ci.md#diagnostic-codes).

- **Object literal**: each property becomes a member. A property whose value is a variable takes that variable's `@type` (or TS annotation) and description. Inline functions without annotations get loose inferred signatures, so annotate them when the shape matters.
- **Variable**: the context type is the variable's type, and its description documents the context. An object type literal (`@type {{ open: () => void }}`) contributes its members instead. An untyped variable is typed from its initializer the way a prop default is (unwrapping `$state`, `$state.raw`, and `$derived`).

```svelte
<script>
  /**
   * Modal controls
   * @type {import("./types").ModalAPI}
   */
  const modalAPI = { open: () => {}, close: () => {} };

  setContext("modal", modalAPI);
</script>
```

```ts
/**
 * Modal controls
 */
export type ModalContext = import("./types").ModalAPI;
```

A variable sveld can't type gives `any` with [`sveld/context-any-type`](ci.md#diagnostic-codes).

## `@restProps`

sveld detects the elements `$$restProps` (or a runes `...rest` binding) is spread onto and types the component's rest props from them. It can't see through a child component, so name the elements with `@restProps`:

```js
/**
 * @restProps {tagname}
 * @restProps {tagname-1 | tagname-2}
 */
```

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

For a `<svelte:element>` whose tag is only known at runtime, use `@restProps {svelte:element}`. It types the rest props as `HTMLAttributes<HTMLElement>`, which is what sveld infers for a direct spread onto that element. You only need it when the spread goes through something sveld can't follow, like a local object:

```svelte
<script>
  /** @restProps {svelte:element} */

  export let tag = "div";

  $: props = { ...$$restProps, class: ["stack", $$restProps.class].join(" ") };
</script>

<svelte:element this={tag} {...props}>
  <slot />
</svelte:element>
```

A spread onto a component without `@restProps` raises [`sveld/rest-props-unresolved`](ci.md#diagnostic-codes).

## `@extendProps`

When a component wraps another, `@extendProps` makes its props extend the wrapped component's generated props. `@extends` is an alias, but `@extendProps` avoids clashing with the standard JSDoc `@extends` for classes.

```js
/**
 * @extendProps {"./Button.svelte"} ButtonProps
 */
```

The path is relative to the component. For a `.svelte` target, the name must match that component's generated `<Name>Props` type exactly. The target can also be a TypeScript module that exports the named type. A missing target raises [`sveld/extend-props-target-missing`](ci.md#diagnostic-codes).

## `@template` / `@generics`

For `lang="ts"` components, declare generics with Svelte's [`generics` attribute](https://svelte.dev/docs/svelte/typescript); sveld reads it directly:

```svelte
<script lang="ts" generics="Row extends DataTableRow = any"></script>
```

Plain JavaScript components use the standard JSDoc [`@template`](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html#template) tag, one per type parameter:

```svelte
<script>
  /**
   * @typedef {{ id: string | number; [key: string]: any; }} DataTableRow
   * @template {DataTableRow} [Row=DataTableRow]
   */

  /** @type {ReadonlyArray<Row>} */
  export let rows = [];
</script>
```

```ts
export type ComponentProps<Row extends DataTableRow = DataTableRow> = {
  /**
   * @default []
   */
  rows?: ReadonlyArray<Row>;
};

export default class Component<Row extends DataTableRow = DataTableRow> extends SvelteComponentTyped<
  ComponentProps<Row>,
  Record<string, any>,
  Record<string, never>
> {}
```

`@generics` is a sveld-specific alternative that takes the full constraint inline, with comma-separated names for more than one:

```js
/**
 * @generics {Row extends DataTableRow = DataTableRow, Header extends DataTableRow = DataTableRow} Row,Header
 */
```

If a component declares generics both ways, the `generics` attribute wins and the JSDoc declaration is reported as [`sveld/syntax-skipped`](ci.md#diagnostic-codes). The attribute on a script without `lang="ts"` is also reported and ignored.

## `@component` comments

The Svelte Language Server reads component-level comments written as `<!-- @component ... -->`. sveld copies them onto the default export in the `.d.ts`.

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

```ts
/**
 * @example
 * <Button>
 *   Text
 * </Button>
 */
export default class Button extends SvelteComponentTyped<
  ...
```

## `@bindable`

`@bindable readonly` or `@bindable writable` documents a prop's intended `bind:` contract. It adds `"binding": "readonly"` or `"binding": "writable"` to the JSON and the Markdown Binding column. It never changes the `.d.ts` prop type.

- `readonly`: the component owns the value, and the consumer binds to read it.
- `writable`: either side may control the value.

```svelte
<script>
  /**
   * Bind to state controlled by either the consumer or component.
   * @bindable writable
   */
  export let open = false;
</script>
```

`binding` is never inferred. Separately, the JSON `reactive` field is a heuristic set when sveld finds evidence a prop is written internally (assigned, `$bindable(...)`, or used as a `bind:` target). See [Prop fields](output.md#prop-fields).

A `@bindable writable` prop (or a runes `$bindable(...)` prop) is listed in the `Bindings` type parameter under `typesOptions.format: "component"`.

## `@deprecated`

`@deprecated` works on props, exported functions, events, slots, and entry exports. An optional message can name a replacement.

```svelte
<script>
  /**
   * The visible label.
   * @deprecated Use the `text` prop instead.
   */
  export let label = "";

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

Placement: for slots, before the `@slot` / `@snippet` line; for events, after the `@event` line; everywhere else, in the JSDoc directly above the declaration.

The `.d.ts` gets an `@deprecated` line, so editors strike the symbol through. JSON adds `deprecated` (the message, or `true` with no message). Markdown strikes through the name and adds a **Deprecated** badge.

## `@ignore` / `@internal`

`@ignore` and `@internal` are aliases. Either one removes a prop, event, slot, typedef, module export, entry export, or context from every output: JSON, Markdown, and `.d.ts`. Placement follows [`@deprecated`](#deprecated).

```svelte
<script>
  /**
   * Implementation detail; not part of the public API.
   * @internal
   */
  export let debugId = "";

  /**
   * Fired for internal diagnostics only.
   * @event {{ reason: string }} debug
   * @internal
   */
</script>
```

For a context, tag the JSDoc on the value variable. A property inside a `setContext` object literal can be hidden by tagging the variable it refers to:

```svelte
<script>
  /**
   * @type {string}
   * @internal
   */
  let debugToken = "";

  let publicUser = { name: "" };

  setContext("session", { user: publicUser, debug: debugToken });
</script>
```

Only `debug` is left out of `SessionContext`.

The raw parse result still records internal members with `internal: true`; [`buildComponentApiDocument`](output.md#custom-output) removes them. Public type text that references an internal typedef raises [`sveld/internal-typedef-referenced`](ci.md#diagnostic-codes).

For [`--check`](ci.md#api-drift-checks---check), marking a public member `@internal` is a breaking change, the same as removing it.

## `@since`, `@see`, `@example`

These three tags are kept as structured tags rather than folded into the description. Each becomes a `tags: [{ "name", "body" }]` entry in JSON, its own line in the `.d.ts` JSDoc, and is appended to the Markdown Description cell. sveld doesn't validate the text.

They attach to props, exported functions, events (before or after the `@event` line), slots (before the `@slot` line), typedefs, and entry exports.

```svelte
<script>
  /**
   * A width prop.
   * @see https://example.com/width-docs
   * @since 1.2.0
   * @type {number}
   */
  let { width = 0 } = $props();
</script>
```

```ts
/**
 * A width prop.
 * @see https://example.com/width-docs
 * @since 1.2.0
 * @default 0
 */
width?: number;
```

```json
{ "name": "width", "description": "A width prop.", "tags": [{ "name": "see", "body": "https://example.com/width-docs" }, { "name": "since", "body": "1.2.0" }] }
```

Markdown Description cell:

```
A width prop.<br />@see https://example.com/width-docs<br />@since 1.2.0
```

An `@example` body is copied as-is. In a Markdown table cell, a fenced code block renders as `<pre><code>` with `<br />` line breaks, since a table row can't span lines:

```
Formats a value.<br />@example <pre><code>formatValue("ok");</code></pre>
```

On an exported function, `@param` and `@returns` go into the type signature rather than staying as JSDoc lines.

With [`checkExamples`](ci.md#checking-example-blocks), sveld also compiles `@example` code blocks.

Any other tag sveld has no meaning for passes through as a `tags` entry on an event, slot, or typedef, and is folded into the description on a prop. An unrecognized tag name raises [`sveld/jsdoc-unknown-tag`](ci.md#diagnostic-codes), with a "did you mean" suggestion when it's close to a tag sveld knows (`@depreacted`).

## `{@link}`

`{@link target}` and `{@link target|text}` are inline tags inside description text. sveld keeps them verbatim in JSON and the `.d.ts`. In Markdown table cells (props, events, slots, entry exports), they are rewritten to Markdown links, `[text](target)`, except inside code fences.

```js
/**
 * The element's width. See {@link https://example.com/width|width docs}.
 * @type {number}
 */
```

Markdown Description cell: `The element's width. See [width docs](https://example.com/width).`

## `@csspart` / `@cssprop`

`@csspart` and `@cssprop` (alias `@cssproperty`) document shadow-DOM styling hooks in the component's own JSDoc block (the one `@slot` tags go in):

```js
/**
 * @csspart header - Styles the header region.
 * @cssprop {Color} [--card-background=white] - Background color of the card.
 * @cssprop --card-border-color - Border color of the card.
 */
```

See [Custom element metadata](output.md#custom-element-metadata).

## `@sveld-ignore`

`@sveld-ignore <code>` on a prop, `@event`, context variable, or event dispatcher suppresses that diagnostic. See [Ignoring diagnostics](ci.md#ignoring-diagnostics).
