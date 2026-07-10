/**
 * Progress logging for the writers.
 *
 * Writers are invoked through the writer registry and don't receive runtime
 * options today, so threading a `quiet` param through every writer signature
 * would be a larger refactor than the CLI's `--quiet` flag warrants. A
 * module-level toggle (set once by `cli()`) is the pragmatic shape instead.
 */
let quiet = false;

/** Sets the module-level quiet toggle. Called once by `cli()`. */
export function setQuiet(value: boolean): void {
  quiet = value;
}

/** Writes a progress line to stderr, suppressed when quiet mode is on. */
export function info(message: string): void {
  if (!quiet) {
    console.error(message);
  }
}
