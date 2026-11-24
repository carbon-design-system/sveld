// A module-level toggle, set once per run by `cli()`, `sveld()`, or the
// plugin, because writers don't receive runtime options.
let quiet = false;

export function setQuiet(value: boolean): void {
  quiet = value;
}

export function info(message: string): void {
  if (!quiet) console.error(message);
}

export function warn(message: string): void {
  if (!quiet) console.error(message);
}
