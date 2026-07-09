/**
 * Dedicated build entrypoint for `cli.js`, kept separate from `./index`.
 *
 * `./index` is the public "sveld" package API and eagerly re-exports the
 * `ComponentParser` class (a real value export, not just a type), which
 * pulls in the whole parser stack. Bundling the CLI against `./index`
 * would force that eager import into the same chunk as `cli()`, defeating
 * the parser stack's lazy loading (see `./parser-stack`) for every CLI
 * invocation. This entrypoint only reaches `cli()`, so a fully cached run
 * never statically needs the parser.
 */
export { cli } from "./cli";
