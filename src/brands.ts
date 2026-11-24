declare const brand: unique symbol;

type Brand<TBase extends string, TBrand extends string> = TBase & {
  readonly [brand]: TBrand;
};

export type SvelteEntryPoint = Brand<string, "SvelteEntryPoint">;
export function asSvelteEntryPoint(path: string): SvelteEntryPoint {
  return path as SvelteEntryPoint;
}

export type NormalizedPath = Brand<string, "NormalizedPath">;
export function asNormalizedPath(path: string): NormalizedPath {
  return path as NormalizedPath;
}

export type RelativeSourcePath = Brand<string, "RelativeSourcePath">;
export function asRelativeSourcePath(path: string): RelativeSourcePath {
  if (path === "") {
    return path as RelativeSourcePath;
  }
  // Only `.` and `..` make a path relative, so `.hidden/x` is a bare name
  // like `x`.
  const isRelative = path === "." || path === ".." || path.startsWith("./") || path.startsWith("../");
  return (isRelative ? path : `./${path}`) as RelativeSourcePath;
}
