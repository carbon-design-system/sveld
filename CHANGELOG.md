# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.3](https://github.com/IBM/sveld/releases/tag/v0.8.3) - 2021-07-29

- replace backslashes with slashes on Windows when reading Svelte files using the glob method

## [0.8.2](https://github.com/IBM/sveld/releases/tag/v0.8.2) - 2021-07-11

- write constant props as accessors in the `SvelteComponentTyped` interface

## [0.8.1](https://github.com/IBM/sveld/releases/tag/v0.8.1) - 2021-07-10

- type function declarations as accessors in the `SvelteComponentTyped` interface
- omit module name from generated TypeScript class if it's the reserved keyword "default"
- move `typescript` to direct dependencies

## [0.8.0](https://github.com/IBM/sveld/releases/tag/v0.8.0) - 2021-06-17

- use `svelte-preprocess` to preprocess TypeScript in Svelte files and remove `style` blocks

## [0.7.1](https://github.com/IBM/sveld/releases/tag/v0.7.1) - 2021-02-20

- only parse files with the `.svelte` file extension

## [0.7.0](https://github.com/IBM/sveld/releases/tag/v0.7.0) - 2021-02-06

- add a `glob` option to resolve Svelte files from entry file exports using `fast-glob` (default is `false`)

## [0.6.1](https://github.com/IBM/sveld/releases/tag/v0.6.1) - 2021-01-09

- use parsed exports to determine module name, Svelte source file path

## [0.6.0](https://github.com/IBM/sveld/releases/tag/v0.6.0) - 2021-01-09

- use `acorn` to parse/create TypeScript exports
- use `fast-glob` to collect all `*.svelte` files from the Svelte source folder specified in `package.json#svelte`
- format TS definitions using a prettier `printWidth` of 80 instead of 120

**Breaking Changes**

- `filePath` in generated JSON output is relative instead of absolute (normalized using `path.normalize`)

## [0.5.0](https://github.com/IBM/sveld/releases/tag/v0.5.0) - 2020-12-05

- generate TypeScript definitions to use `SvelteComponentTyped` interface instead of `SvelteComponent`

**Breaking Changes**

- Svelte version >=3.31 is required to use generated TypeScript definitions

## [0.4.2](https://github.com/IBM/sveld/releases/tag/v0.4.2) - 2020-11-25

**Fixes**

- account for `:` when clamping object keys

## [0.4.1](https://github.com/IBM/sveld/releases/tag/v0.4.1) - 2020-11-25

**Fixes**

- clamp slot/event keys in TypeScript definitions

## [0.4.1](https://github.com/IBM/sveld/releases/tag/v0.4.0) - 2020-11-25

- output format for TypeScript definitions extends `SvelteComponent` instead of stubbing class internals used by the Svelte Language Server

**Breaking Changes**

- Svelte version >=3.30 is required to use generated TypeScript definitions

## [0.3.0](https://github.com/IBM/sveld/releases/tag/v0.3.0) - 2020-11-25

- export component `typedefs` in TypeScript definitions

## [0.2.1](https://github.com/IBM/sveld/releases/tag/v0.2.1) - 2020-11-19

- extend interface for empty props use case

## [0.2.0](https://github.com/IBM/sveld/releases/tag/v0.2.0) - 2020-11-19

- support `@extends` tag to extend imported component prop interfaces

## [0.1.0](https://github.com/IBM/sveld/releases/tag/v0.1.0) - 2020-11-19

- support `@restProps` tag
- fix "undefined" event by checking if the event name is undefined

## [0.1.0-rc.5](https://github.com/IBM/sveld/releases/tag/v0.1.0-rc.5) - 2020-11-18

- use `package.json#svelte` for the entry point to uncompiled Svelte source code

## [0.1.0-rc.4](https://github.com/IBM/sveld/releases/tag/v0.1.0-rc.4) - 2020-11-17

- add `rollup` to dependencies

## [0.1.0-rc.3](https://github.com/IBM/sveld/releases/tag/v0.1.0-rc.3) - 2020-11-17

- add `svelte` to dependencies

## [0.1.0-rc.2](https://github.com/IBM/sveld/releases/tag/v0.1.0-rc.2) - 2020-11-17

- add `cli.js` to publishable files

## [0.1.0-rc.1](https://github.com/IBM/sveld/releases/tag/v0.1.0-rc.1) - 2020-11-17

- enable CLI usage by wrapping Rollup plugin

## [0.1.0-rc.0](https://github.com/IBM/sveld/releases/tag/v0.1.0-rc.0) - 2020-11-16

- initial release
