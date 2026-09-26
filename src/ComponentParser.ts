/**
 * The component parser's public face. A parse runs in four phases over one
 * {@link ParserContext}: `prepareComponent` (parser/prepare.ts),
 * `walkModuleScript` (parser/module-script.ts), `walkComponent`
 * (parser/component-walk.ts), and `finalizeComponent` (parser/finalize.ts).
 */
import type { ComponentParseResult, ParsedComponent } from "./model";
import { PARSED_COMPONENT_TYPE_SCRIPT_METADATA } from "./parsed-component-metadata";
import { walkComponent } from "./parser/component-walk";
import { createParserContext, type ParserContext } from "./parser/context";
import { finalizeComponent } from "./parser/finalize";
import { walkModuleScript } from "./parser/module-script";
import { prepareComponent } from "./parser/prepare";

interface ComponentParserDiagnostics {
  moduleName: string;
  filePath: string;
}

export default class ComponentParser {
  /**
   * All per-parse mutable state (props, slots, events, scopes, source, etc.).
   * See {@link ParserContext} for field-by-field documentation. Replaced
   * wholesale by `cleanup()` between parses.
   */
  private ctx: ParserContext = createParserContext();

  /**
   * Resets parser state for reuse between parses.
   *
   * @example
   * ```ts
   * parser.parseSvelteComponent(source1, diagnostics1);
   * parser.cleanup();
   * parser.parseSvelteComponent(source2, diagnostics2);
   * ```
   */
  public cleanup() {
    this.ctx = createParserContext();
  }

  /**
   * @example
   * ```ts
   * const parser = new ComponentParser();
   * const result = parser.parseSvelteComponent(source, {
   *   moduleName: "Button",
   *   filePath: "./Button.svelte"
   * });
   * // { props, slots, events, typedefs, ... }
   * ```
   */
  public parseSvelteComponent(source: string, diagnostics: ComponentParserDiagnostics): ParsedComponent {
    const { component, pending } = this.parse(source, diagnostics);
    if (pending) {
      component[PARSED_COMPONENT_TYPE_SCRIPT_METADATA] = {
        ...(component[PARSED_COMPONENT_TYPE_SCRIPT_METADATA] ?? {
          canonicalPropNames: [],
          localTypeDeclarations: [],
          typeImportStatements: [],
        }),
        ...pending,
      };
    }
    return component;
  }

  /**
   * Like {@link parseSvelteComponent}, but returns the candidates only a
   * pass with file access can resolve beside the component rather than
   * inside its metadata.
   */
  public parse(source: string, diagnostics: ComponentParserDiagnostics): ComponentParseResult {
    this.cleanup();
    const ctx = this.ctx;
    prepareComponent(ctx, source, diagnostics.filePath);
    walkModuleScript(ctx);
    const walk = walkComponent(ctx);
    return finalizeComponent(ctx, walk);
  }
}
