declare const brand: unique symbol;

export type Brand<TBase extends string, TBrand extends string> = TBase & {
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
  return (path.startsWith(".") ? path : `./${path}`) as RelativeSourcePath;
}
