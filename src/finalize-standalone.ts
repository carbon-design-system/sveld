/**
 * Finalize a standalone parse (`sveld/browser`, or `ComponentParser` used
 * directly), where nothing reads the other files a component imports from.
 */
import type { ParsedComponent, ParsedComponentTypeScriptMetadata, SourceRange } from "./ComponentParser";
import { createDiagnostic, type SveldDiagnostic } from "./diagnostics";
import { PARSED_COMPONENT_TYPE_SCRIPT_METADATA } from "./parsed-component-metadata";

export interface FinalizeWithoutCrossFileResolutionOptions {
  /** Path recorded on the new diagnostics. Defaults to the component's own `filePath`, if it has one. */
  filePath?: string;
}

const TRAILING_PERIOD_REGEX = /\.$/;

const FILE_ACCESS = "resolving it needs file access (generateBundle or the CLI)";

/** The export an import names, read through namespace exports: `keys.THEME`. */
function importPath(candidate: { importedName: string; members?: string[] }): string {
  return [candidate.importedName, ...(candidate.members ?? [])].join(".");
}

/**
 * Settle the cross-file candidates `parseSvelteComponent` leaves for
 * `generateBundle`, for a caller that will never resolve them. Each pending
 * imported `setContext` key, imported-const or imported-call prop default,
 * and imported dispatch helper gets a `cross-file-unresolved` warning naming
 * the import, and the `event-no-source` diagnostics held back for those
 * helpers are released.
 *
 * Returns a new component (the input is not modified) whose pending
 * candidates are cleared, so a second call adds nothing. A component with
 * nothing pending is returned as-is.
 *
 * @example
 * ```ts
 * const diagnostics = { moduleName: "Button", filePath: "Button.svelte" };
 * const parsed = finalizeWithoutCrossFileResolution(parser.parseSvelteComponent(source, diagnostics), diagnostics);
 * ```
 */
export function finalizeWithoutCrossFileResolution<T extends ParsedComponent>(
  component: T,
  options: FinalizeWithoutCrossFileResolutionOptions = {},
): T {
  const metadata = component[PARSED_COMPONENT_TYPE_SCRIPT_METADATA];
  if (!metadata) return component;

  const {
    pendingCallDefaultCandidates,
    pendingConstDefaultCandidates,
    pendingContextKeyCandidates,
    pendingDispatchEscapeCandidates,
    deferredEventNoSourceDiagnostics,
    untypedJsDocEventNames: _untypedJsDocEventNames,
    ...rest
  } = metadata;
  const callDefaults = (pendingCallDefaultCandidates ?? []).filter((candidate) => candidate.importSource !== undefined);
  if (
    callDefaults.length === 0 &&
    !pendingConstDefaultCandidates &&
    !pendingContextKeyCandidates &&
    !pendingDispatchEscapeCandidates &&
    !deferredEventNoSourceDiagnostics
  ) {
    return component;
  }

  const ownFilePath = (component as { filePath?: unknown }).filePath;
  const filePath = options.filePath ?? (typeof ownFilePath === "string" ? ownFilePath : "");
  const added: SveldDiagnostic[] = [];
  const record = (name: string, message: string, source: SourceRange | undefined, ignored?: boolean) => {
    added.push(
      createDiagnostic({
        component: filePath,
        kind: "cross-file-unresolved",
        name,
        message,
        ...(source ? { source } : {}),
        ...(ignored ? { ignored } : {}),
      }),
    );
  };
  const propSource = (location: "props" | "moduleExports", propName: string) =>
    (location === "props" ? component.props : component.moduleExports).find((prop) => prop.name === propName)?.source;
  const label = (location: "props" | "moduleExports") => (location === "props" ? "Prop" : "Module export");

  for (const candidate of pendingContextKeyCandidates ?? []) {
    const key = importPath(candidate);
    record(
      key,
      `setContext key \`${key}\` is imported from "${candidate.importSource}"; ${FILE_ACCESS}, so the context is omitted.`,
      candidate.source,
    );
  }

  for (const candidate of pendingConstDefaultCandidates ?? []) {
    record(
      candidate.propName,
      `${label(candidate.location)} "${candidate.propName}" defaults to \`${importPath(candidate)}\` imported from "${candidate.importSource}"; ${FILE_ACCESS}, so the default shows the identifier and its type isn't read.`,
      propSource(candidate.location, candidate.propName),
    );
  }

  for (const candidate of callDefaults) {
    record(
      candidate.propName,
      `${label(candidate.location)} "${candidate.propName}" defaults to \`${candidate.calleeName}()\` imported from "${candidate.importSource}"; ${FILE_ACCESS}, so its return type isn't read and the prop falls back to "any".`,
      propSource(candidate.location, candidate.propName),
    );
  }

  for (const candidate of pendingDispatchEscapeCandidates ?? []) {
    record(
      candidate.calleeText,
      `\`${candidate.dispatcherName}\` is passed to \`${candidate.calleeText}\`, imported from "${candidate.importSource}"; reading the events it dispatches needs file access (generateBundle or the CLI), so they're omitted.`,
      candidate.source,
      // `@sveld-ignore sveld/dispatch-escapes`: the author documented the helper's events with `@event`.
      candidate.ignored,
    );
  }

  const helpers = Array.from(
    new Set((pendingDispatchEscapeCandidates ?? []).map((candidate) => `\`${candidate.calleeText}\``)),
  ).join(", ");
  const released = (deferredEventNoSourceDiagnostics ?? []).map((diagnostic) =>
    helpers
      ? {
          ...diagnostic,
          message: `${diagnostic.message.replace(TRAILING_PERIOD_REGEX, "")} in this file; ${helpers} may dispatch it, but imported helpers aren't read without file access.`,
        }
      : diagnostic,
  );

  const finalized: T = {
    ...component,
    diagnostics: [...(component.diagnostics ?? []), ...released, ...added],
  };
  finalized[PARSED_COMPONENT_TYPE_SCRIPT_METADATA] = rest as ParsedComponentTypeScriptMetadata;
  return finalized;
}
