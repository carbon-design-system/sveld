declare const brand: unique symbol;

type Brand<TBase extends string, TBrand extends string> = TBase & {
  readonly [brand]: TBrand;
};

// A brand exists only at compile time, so no runtime check can narrow a
// string to one; this is the single place a string becomes branded.
function brandAs<T extends Brand<string, string>>(value: string): T {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a phantom brand has no runtime test to narrow with.
  return value as T;
}

export type SvelteEntryPoint = Brand<string, "SvelteEntryPoint">;
export function asSvelteEntryPoint(path: string): SvelteEntryPoint {
  return brandAs(path);
}

export type NormalizedPath = Brand<string, "NormalizedPath">;
export function asNormalizedPath(path: string): NormalizedPath {
  return brandAs(path);
}

export type RelativeSourcePath = Brand<string, "RelativeSourcePath">;
export function asRelativeSourcePath(path: string): RelativeSourcePath {
  if (path === "") {
    return brandAs(path);
  }
  // Only `.` and `..` make a path relative, so `.hidden/x` is a bare name
  // like `x`.
  const isRelative = path === "." || path === ".." || path.startsWith("./") || path.startsWith("../");
  return brandAs(isRelative ? path : `./${path}`);
}
