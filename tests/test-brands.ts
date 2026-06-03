import { asNormalizedPath, asRelativeSourcePath, type NormalizedPath, type RelativeSourcePath } from "../src/brands";
import type { ParsedExports } from "../src/parse-exports";
import type { ComponentDocApi } from "../src/plugin";

export function mockRelativeSourcePath(source: string): RelativeSourcePath {
  return asRelativeSourcePath(source);
}

export function mockParsedExport(source: string, options?: { default?: boolean; mixed?: boolean }) {
  return {
    source: mockRelativeSourcePath(source),
    default: options?.default ?? false,
    ...(options?.mixed ? { mixed: true } : {}),
  } satisfies ParsedExports[string];
}

export function mockParsedExports(exports: Record<string, ReturnType<typeof mockParsedExport>>): ParsedExports {
  return exports;
}

export function mockComponentDocApi(
  moduleName: string,
  filePath: string,
  overrides?: Partial<ComponentDocApi>,
): ComponentDocApi {
  return {
    moduleName,
    filePath: asNormalizedPath(filePath),
    syntaxMode: "legacy",
    props: [],
    moduleExports: [],
    slots: [],
    events: [],
    typedefs: [],
    generics: null,
    rest_props: undefined,
    contexts: [],
    ...overrides,
  };
}

export type { NormalizedPath, RelativeSourcePath };
