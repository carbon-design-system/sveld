# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.24.3](https://github.com/carbon-design-system/sveld/releases/tag/v0.24.3) - 2025-11-23

**Fixes**

- recognize `MemberExpression` defaults (e.g., `Number.POSITIVE_INFINITY`, `Math.PI`)
- use `export declare const` for module const exports

## [0.24.2](https://github.com/carbon-design-system/sveld/releases/tag/v0.24.2) - 2025-11-09

**Fixes**

- extract `@type` and `@param` tags from JSDocs

## [0.24.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.24.1) - 2025-11-09

**Fixes**

- group named exports from same source file

## [0.24.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.24.0) - 2025-11-09

**Breaking Changes**

- respect named exports in generated types
- remove function body code from documentation output

**Fixes**

- handle directory input with glob option

## [0.23.4](https://github.com/carbon-design-system/sveld/releases/tag/v0.23.4) - 2025-11-09

**Fixes**

- resolve TypeScript path aliases in component imports
- support `entry` option in rollup plugin
- make style tag regex non-greedy to handle template literals
- parallelize writing and hoist standard DOM events set
- parallelize parsing
- cache vars and hoist regexes
- cache parsed AST

## [0.23.3](https://github.com/carbon-design-system/sveld/releases/tag/v0.23.3) - 2025-11-09

**Fixes**

- generate valid TypeScript for arrow function exports
- handle re-exports in both module and instance scripts
- capture non-literal default values in prop parsing

## [0.23.2](https://github.com/carbon-design-system/sveld/releases/tag/v0.23.2) - 2025-11-08

**Fixes**

- support optional properties in `@property` tags for typedefs and `@event` tags

## [0.23.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.23.1) - 2025-11-07

**Fixes**

- use `Record<string, never>` for empty context types

## [0.23.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.23.0) - 2025-11-07

**Breaking Changes**

- change default slot name from `"__default__"` to `null`
- replace `{}` type with `Record<string, never>` in TypeScript definitions for empty props and slots. This may cause type errors if you intersect or extend these types, as `Record<string, never>` disallows any properties while `{}` was more permissive

**Features**

- support `@property` tags for `@typedef`
- support `setContext` API
- support `@event` descriptions and `@property` notation

**Fixes**

- use literal keys instead of bracket notation in TypeScript definitions

## [0.22.5](https://github.com/carbon-design-system/sveld/releases/tag/v0.22.5) - 2025-11-07

**Fixes**

- restore slot props type inference
- prioritize explicit `@event` detail types over defaults

## [0.22.4](https://github.com/carbon-design-system/sveld/releases/tag/v0.22.4) - 2025-11-07

**Fixes**

- handle undefined and null detail strings in forwarded events
- preserve custom event types when forwarded from components
- restore slot flow logic
- loosen comment parsing when stripping `@ts` directives

## [0.22.3](https://github.com/carbon-design-system/sveld/releases/tag/v0.22.3) - 2025-11-03

**Fixes**

- filter TypeScript directives when parsing JSDoc comments
- forwarded events should use `@event` tags

## [0.22.2](https://github.com/carbon-design-system/sveld/releases/tag/v0.22.2) - 2025-11-02

**Fixes**

- merge `@extends` props with `@restProps` in type generation

## [0.22.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.22.1) - 2025-02-17

**Fixes**

- improve error handling for missing Svelte entry file

## [0.22.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.22.0) - 2024-11-10

**Breaking Changes**

- upgrade `prettier` to v3 (by default, `trailingComma` is now "all")

## [0.21.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.21.0) - 2024-10-27

**Breaking Changes**

- use type alias instead of interface for exported component props type

**Fixes**

- prefix internal `RestProps` type with `$` to avoid conflicts with `Rest.svelte` as a component name

## [0.20.3](https://github.com/carbon-design-system/sveld/releases/tag/v0.20.3) - 2024-10-25

**Fixes**

- use `WindowEventMap` for cut/copy/paste events

## [0.20.2](https://github.com/carbon-design-system/sveld/releases/tag/v0.20.2) - 2024-09-13

**Fixes**

- reduce dependencies by upgrading `svelte-preprocess` from v5 to v6

## [0.20.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.20.1) - 2024-09-12

**Fixes**

- reduce dependencies by replacing `fast-glob` with `tinyglobby`

## [0.20.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.20.0) - 2024-04-20

**Features**

- support component generics via the custom `@generics` tag

## [0.19.2](https://github.com/carbon-design-system/sveld/releases/tag/v0.19.2) - 2024-04-08

**Fixes**

- `ComponentParser` should remove carriage returns (Windows)

## [0.19.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.19.1) - 2023-10-17

**Fixes**

- only print `outFile` when writing Markdown file
- upgrade `svelte-preprocess` and `typescript` to ameliorate peer dependency warning

## [0.19.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.19.0) - 2023-07-19

**Breaking Changes**

- if using Svelte 3, the generated TypeScript definitions now require version 3.55 or higher

**Features**

- support Svelte 4 in the generated TypeScript definitions

## [0.18.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.18.1) - 2023-06-04

- allow `data-*` attributes for props forwarded to HTML elements for `svelte-check@3.x` compatibility

## [0.18.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.18.0) - 2022-10-22

- support `@slot` tag descriptions for named slots
- support `@event` tag descriptions
- remove `sveltekit:*` attributes from type definitions

## [0.17.2](https://github.com/carbon-design-system/sveld/releases/tag/v0.17.2) - 2022-06-13

- handle `export {}` in script block

## [0.17.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.17.1) - 2022-06-02

- use correct type for forwarded cut/copy/paste events

## [0.17.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.17.0) - 2022-05-21

- remove `@required` tag; directly infer if a prop is required

## [0.16.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.16.1) - 2022-05-20

- `additional_tags` can be `undefined`

## [0.16.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.16.0) - 2022-05-19

- support `@required` tag to denote required component props
- support wildcard export in svelte entry point

## [0.15.3](https://github.com/carbon-design-system/sveld/releases/tag/v0.15.3) - 2022-05-14

- preserve JSDoc tags in prop comments

## [0.15.2](https://github.com/carbon-design-system/sveld/releases/tag/v0.15.2) - 2022-05-13

- dispatched event type without detail should default to `null`, not `any`

## [0.15.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.15.1) - 2022-05-01

- function exported from `<script context="module">` should be typed as functions, not types

## [0.15.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.15.0) - 2022-04-14

- add `jsonOptions.outDir` option to emit JSON files for individual components
- add `sveltekit:reload` attributes to props that extend `a` attributes

## [0.14.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.14.1) - 2022-04-09

- svg `$$restProps` should extend the correct attributes

## [0.14.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.14.0) - 2022-04-09

- add `sveltekit:prefetch`, `sveltekit:noscroll` attributes to props that extend `a` attributes
- use type-only imports for `SvelteComponentTyped` and extended props

## [0.13.4](https://github.com/carbon-design-system/sveld/releases/tag/v0.13.4) - 2022-02-26

- use file name as module name if library only has a single default export

## [0.13.3](https://github.com/carbon-design-system/sveld/releases/tag/v0.13.3) - 2022-02-13

- component module exports should not be recognized as accessors

## [0.13.2](https://github.com/carbon-design-system/sveld/releases/tag/v0.13.2) - 2022-02-10

- do not wrap TS `@event` detail in `CustomEvent` if type contains `CustomEvent`

## [0.13.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.13.1) - 2022-01-22

- return original entry point instead of resolved path in `getSvelteEntry`

## [0.13.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.13.0) - 2022-01-22

- export `sveld` for programmatic usage
- upgrade prettier, rollup, svelte, svelte-preprocess, typescript

## [0.12.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.12.1) - 2022-01-20

- specify `@default undefined` for undefined prop values (i.e., `let prop1; let prop2 = undefined`)

## [0.12.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.12.0) - 2022-01-02

- support props defined via renamed exports (i.e., `let className; export { className as class }`)

## [0.11.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.11.1) - 2021-12-31

- replace backslashes with forward slashes in COMPONENT_API.json `filePath` values

## [0.11.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.11.0) - 2021-12-16

- support writing `<!-- @component -->` comments in Svelte components to TypeScript definitions

## [0.10.2](https://github.com/carbon-design-system/sveld/releases/tag/v0.10.2) - 2021-08-29

- tolerate slot spread syntax (`<slot {...props} />`) when parsing Svelte components

## [0.10.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.10.1) - 2021-08-28

- include `.svelte` extension in `index.d.ts` exports

## [0.10.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.10.0) - 2021-08-28

- use `.svelte.d.ts` for Svelte files in type definitions to enable direct imports

## [0.9.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.9.0) - 2021-08-28

- omit `@constant`, `@default` notations for component accessors

## [0.8.3](https://github.com/carbon-design-system/sveld/releases/tag/v0.8.3) - 2021-07-29

- replace backslashes with slashes on Windows when reading Svelte files using the glob method

## [0.8.2](https://github.com/carbon-design-system/sveld/releases/tag/v0.8.2) - 2021-07-11

- write constant props as accessors in the `SvelteComponentTyped` interface

## [0.8.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.8.1) - 2021-07-10

- type function declarations as accessors in the `SvelteComponentTyped` interface
- omit module name from generated TypeScript class if it's the reserved keyword "default"
- move `typescript` to direct dependencies

## [0.8.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.8.0) - 2021-06-17

- use `svelte-preprocess` to preprocess TypeScript in Svelte files and remove `style` blocks

## [0.7.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.7.1) - 2021-02-20

- only parse files with the `.svelte` file extension

## [0.7.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.7.0) - 2021-02-06

- add a `glob` option to resolve Svelte files from entry file exports using `fast-glob` (default is `false`)

## [0.6.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.6.1) - 2021-01-09

- use parsed exports to determine module name, Svelte source file path

## [0.6.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.6.0) - 2021-01-09

- use `acorn` to parse/create TypeScript exports
- use `fast-glob` to collect all `*.svelte` files from the Svelte source folder specified in `package.json#svelte`
- format TS definitions using a prettier `printWidth` of 80 instead of 120

**Breaking Changes**

- `filePath` in generated JSON output is relative instead of absolute (normalized using `path.normalize`)

## [0.5.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.5.0) - 2020-12-05

- generate TypeScript definitions to use `SvelteComponentTyped` interface instead of `SvelteComponent`

**Breaking Changes**

- Svelte version >=3.31 is required to use generated TypeScript definitions

## [0.4.2](https://github.com/carbon-design-system/sveld/releases/tag/v0.4.2) - 2020-11-25

**Fixes**

- account for `:` when clamping object keys

## [0.4.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.4.1) - 2020-11-25

**Fixes**

- clamp slot/event keys in TypeScript definitions

## [0.4.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.4.0) - 2020-11-25

- output format for TypeScript definitions extends `SvelteComponent` instead of stubbing class internals used by the Svelte Language Server

**Breaking Changes**

- Svelte version >=3.30 is required to use generated TypeScript definitions

## [0.3.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.3.0) - 2020-11-25

- export component `typedefs` in TypeScript definitions

## [0.2.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.2.1) - 2020-11-19

- extend interface for empty props use case

## [0.2.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.2.0) - 2020-11-19

- support `@extends` tag to extend imported component prop interfaces

## [0.1.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.1.0) - 2020-11-19

- support `@restProps` tag
- fix "undefined" event by checking if the event name is undefined

## [0.1.0-rc.5](https://github.com/carbon-design-system/sveld/releases/tag/v0.1.0-rc.5) - 2020-11-18

- use `package.json#svelte` for the entry point to uncompiled Svelte source code

## [0.1.0-rc.4](https://github.com/carbon-design-system/sveld/releases/tag/v0.1.0-rc.4) - 2020-11-17

- add `rollup` to dependencies

## [0.1.0-rc.3](https://github.com/carbon-design-system/sveld/releases/tag/v0.1.0-rc.3) - 2020-11-17

- add `svelte` to dependencies

## [0.1.0-rc.2](https://github.com/carbon-design-system/sveld/releases/tag/v0.1.0-rc.2) - 2020-11-17

- add `cli.js` to publishable files

## [0.1.0-rc.1](https://github.com/carbon-design-system/sveld/releases/tag/v0.1.0-rc.1) - 2020-11-17

- enable CLI usage by wrapping Rollup plugin

## [0.1.0-rc.0](https://github.com/carbon-design-system/sveld/releases/tag/v0.1.0-rc.0) - 2020-11-16

- initial release
