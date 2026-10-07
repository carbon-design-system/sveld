/**
 * Build entrypoint for `cli.js`. Not `./index`: that eagerly re-exports the
 * `ComponentParser` value, which would pull the parser stack into the CLI
 * chunk and defeat its lazy loading (see `./parser-stack`).
 */
export { cli } from "./cli";
