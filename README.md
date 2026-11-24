# sveld

Generate TypeScript definitions and component documentation for your Svelte components.

sveld reads your components' props, events, slots, snippets and context, and the JSDoc where inference isn't enough, and writes `.d.ts` files your users' editors type-check against, plus JSON and Markdown docs from the same pass. It's for JavaScript-first libraries; one built with `svelte-package` already gets `.d.ts` files from `svelte2tsx`. A type it can't pin down falls back to `any`, and `--strict` says where. [Carbon Components Svelte](https://github.com/carbon-design-system/carbon-components-svelte) generates its types and API docs with it.

```svelte
<!-- src/Button.svelte -->
<script>
  /** @type {"button" | "submit" | "reset"} */
  export let type = "button";

  /** Set to `true` to use the primary variant */
  export let primary = false;
</script>

<button {...$$restProps} {type} class:primary on:click>
  <slot>Click me</slot>
</button>
```

```ts
// types/Button.svelte.d.ts, from `npx sveld` (imports left out)
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

**An API change fails CI before it ships.** Commit `COMPONENT_API.json`, and `--check` diffs each run against it:

```console
$ npx sveld --check
sveld --check: 2 API changes detected against "COMPONENT_API.json".
Suggested semver bump: major.

  Button
    [BREAKING] prop "label" added (required)
    [BREAKING] prop "primary" removed
```

It runs on Node 22 or later, or Bun, and parses Svelte 3, 4 and 5, runes included.

## Quick start

```sh
npm i -D sveld
```

```json
{
  "svelte": "./src/index.js"
}
```

```sh
npx sveld                    # writes types/*.d.ts for what src/index.js exports
```

Exit status: `0` when done, `1` when the run found problems, `2` when it was called wrong or couldn't finish.

## Common tasks

```sh
# Write the JSON and Markdown docs too
npx sveld --json --markdown

# Fail CI on a breaking API change against COMPONENT_API.json
npx sveld --check

# Fail CI where a prop fell back to `any` or a tag was dropped
npx sveld --strict

# Every .svelte file under the entry's directory, not just its exports
npx sveld --glob

# Svelte 5's `Component` type instead of a class
npx sveld --types-format=component

# Check the @example blocks against your TypeScript program
npx sveld --check-examples
```

With `--format=json`, the `--check` report and an exit-`2` error print as JSON on stdout, each with a `schemaVersion`. The same options go in a `sveld.config.js`, or to the Vite plugin: `sveld({ json: true })` in `vite.config.ts`.

## From code

```js
import { sveld } from "sveld";

const { document, diagnostics, exitCode, failures } = await sveld({
  entry: "./src/index.js",
  json: true,
});
document.components; // the same document `json: true` writes
```

## Docs

- [Options](https://github.com/carbon-design-system/sveld/blob/main/docs/options.md): every option and flag, the config file, the Vite plugin, `sveld()`, `sveld/browser`, and requirements
- [JSDoc tags](https://github.com/carbon-design-system/sveld/blob/main/docs/jsdoc-tags.md): how types are inferred, and every tag sveld reads
- [Output](https://github.com/carbon-design-system/sveld/blob/main/docs/output.md): a worked example, `.d.ts` formats, JSON and its schema, Markdown, and custom output
- [CI](https://github.com/carbon-design-system/sveld/blob/main/docs/ci.md): exit codes, `--check`, `--strict` and diagnostic codes, and `@example` checks
- [Troubleshooting](https://github.com/carbon-design-system/sveld/blob/main/docs/troubleshooting.md): common problems, and the fix for each
- [Playground](https://sveld.onrender.com): try it in the browser
