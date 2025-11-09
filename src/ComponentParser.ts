// TODO: upgrading to Svelte 4 shows a lot of TS errors. Ignore for now but resolve.
// @ts-nocheck
import * as commentParser from "comment-parser";
import type { VariableDeclaration } from "estree";
import type { Node } from "estree-walker";
import { compile, parse, walk } from "svelte/compiler";
import type { Ast, TemplateNode, Var } from "svelte/types/compiler/interfaces";
import { getElementByTag } from "./element-tag-map";

interface CompiledSvelteCode {
  vars: Var[];
  ast: Ast;
}

interface ComponentParserDiagnostics {
  moduleName: string;
  filePath: string;
}

interface ComponentParserOptions {
  verbose?: boolean;
}

type ComponentPropName = string;

interface ComponentProp {
  name: string;
  kind: "let" | "const" | "function";
  constant: boolean;
  type?: string;
  value?: string;
  description?: string;
  isFunction: boolean;
  isFunctionDeclaration: boolean;
  isRequired: boolean;
  reactive: boolean;
}

const DEFAULT_SLOT_NAME = null;

type ComponentSlotName = typeof DEFAULT_SLOT_NAME | string;

interface ComponentSlot {
  name?: string | null;
  default: boolean;
  fallback?: string;
  slot_props?: string;
  description?: string;
}

interface SlotPropValue {
  value?: string;
  replace: boolean;
}

type SlotProps = Record<string, SlotPropValue>;

type ComponentEventName = string;

interface ForwardedEvent {
  type: "forwarded";
  name: string;
  element: ComponentInlineElement | ComponentElement;
  description?: string;
  detail?: string;
}

interface DispatchedEvent {
  type: "dispatched";
  name: string;
  detail?: string;
  description?: string;
}

type ComponentEvent = ForwardedEvent | DispatchedEvent;

type TypeDefName = string;

interface TypeDef {
  type: string;
  name: string;
  description?: string;
  ts: string;
}

type ComponentGenerics = [name: string, type: string];

interface ComponentInlineElement {
  type: "InlineComponent";
  name: string;
}

interface ComponentElement {
  type: "Element";
  name: string;
}

type RestProps = undefined | ComponentInlineElement | ComponentElement;

interface Extends {
  interface: string;
  import: string;
}

interface ComponentPropBindings {
  elements: string[];
}

type ComponentContextName = string;

interface ComponentContextProp {
  name: string;
  type: string;
  description?: string;
  optional: boolean;
}

interface ComponentContext {
  key: string;
  typeName: string;
  description?: string;
  properties: ComponentContextProp[];
}

export interface ParsedComponent {
  props: ComponentProp[];
  moduleExports: ComponentProp[];
  slots: ComponentSlot[];
  events: ComponentEvent[];
  typedefs: TypeDef[];
  generics: null | ComponentGenerics;
  rest_props: RestProps;
  extends?: Extends;
  componentComment?: string;
  contexts?: ComponentContext[];
}

export default class ComponentParser {
  private options?: ComponentParserOptions;
  private source?: string;
  private compiled?: CompiledSvelteCode;
  private parsed?: Ast;
  private rest_props?: RestProps;
  private extends?: Extends;
  private componentComment?: string;
  private readonly reactive_vars: Set<string> = new Set();
  private readonly vars: Set<VariableDeclaration> = new Set();
  private readonly props: Map<ComponentPropName, ComponentProp> = new Map();
  private readonly moduleExports: Map<ComponentPropName, ComponentProp> = new Map();
  private readonly slots: Map<ComponentSlotName, ComponentSlot> = new Map();
  private readonly events: Map<ComponentEventName, ComponentEvent> = new Map();
  private readonly eventDescriptions: Map<ComponentEventName, string | undefined> = new Map();
  private readonly forwardedEvents: Map<ComponentEventName, ComponentInlineElement | ComponentElement> = new Map();
  private readonly typedefs: Map<TypeDefName, TypeDef> = new Map();
  private readonly generics: ComponentGenerics = null;
  private readonly bindings: Map<ComponentPropName, ComponentPropBindings> = new Map();
  private readonly contexts: Map<ComponentContextName, ComponentContext> = new Map();

  constructor(options?: ComponentParserOptions) {
    this.options = options;
  }

  private static mapToArray<T>(map: Map<string, T>) {
    return Array.from(map, ([_key, value]) => value);
  }

  private static assignValue(value?: "" | string) {
    return value === undefined || value === "" ? undefined : value;
  }

  private static formatComment(comment: string) {
    let formatted_comment = comment;

    if (!formatted_comment.startsWith("/*")) {
      formatted_comment = `/*${formatted_comment}`;
    }

    if (!formatted_comment.endsWith("*/")) {
      formatted_comment += "*/";
    }

    return formatted_comment;
  }

  /**
   * Finds the last comment from an array of leading comments.
   * TypeScript directives are stripped before parsing, so we can safely take the last comment.
   */
  private static findJSDocComment(leadingComments: unknown[]): unknown {
    if (!leadingComments || leadingComments.length === 0) return undefined;
    return leadingComments[leadingComments.length - 1];
  }

  private sourceAtPos(start: number, end: number) {
    return this.source?.slice(start, end);
  }

  private collectReactiveVars() {
    this.compiled?.vars
      .filter(({ reassigned, writable }) => reassigned && writable)
      .forEach(({ name }) => {
        this.reactive_vars.add(name);
      });
  }

  private addProp(prop_name: string, data: ComponentProp) {
    if (ComponentParser.assignValue(prop_name) === undefined) return;

    if (this.props.has(prop_name)) {
      const existing_slot = this.props.get(prop_name);

      this.props.set(prop_name, {
        ...existing_slot,
        ...data,
      });
    } else {
      this.props.set(prop_name, data);
    }
  }

  private addModuleExport(prop_name: string, data: ComponentProp) {
    if (ComponentParser.assignValue(prop_name) === undefined) return;

    if (this.moduleExports.has(prop_name)) {
      const existing_slot = this.moduleExports.get(prop_name);

      this.moduleExports.set(prop_name, {
        ...existing_slot,
        ...data,
      });
    } else {
      this.moduleExports.set(prop_name, data);
    }
  }

  private aliasType(type: string) {
    if (type === "*") return "any";
    return type;
  }

  private addSlot({
    slot_name,
    slot_props,
    slot_fallback,
    slot_description,
  }: {
    slot_name?: string;
    slot_props?: string;
    slot_fallback?: string;
    slot_description?: string;
  }) {
    const default_slot = slot_name === undefined || slot_name === "";
    const name: ComponentSlotName = default_slot ? DEFAULT_SLOT_NAME : (slot_name ?? "");
    const fallback = ComponentParser.assignValue(slot_fallback);
    const props = ComponentParser.assignValue(slot_props);
    const description = slot_description?.split("-").pop()?.trim();

    if (this.slots.has(name)) {
      const existing_slot = this.slots.get(name);

      this.slots.set(name, {
        ...existing_slot,
        fallback,
        slot_props: existing_slot.slot_props === undefined ? props : existing_slot.slot_props,
        description: existing_slot.description || description,
      });
    } else {
      this.slots.set(name, {
        name,
        default: default_slot,
        fallback,
        slot_props,
        description,
      });
    }
  }

  private addDispatchedEvent({
    name,
    detail,
    has_argument,
    description,
  }: Pick<DispatchedEvent, "name" | "description"> & { detail: string; has_argument: boolean }) {
    if (name === undefined) return;

    /**
     * `e.detail` should be `null` if the dispatcher
     * is not provided a second argument and if
     * `@event` is not specified.
     */
    const default_detail = !has_argument && !detail ? "null" : ComponentParser.assignValue(detail);
    const event_description = description?.split("-").pop()?.trim();
    if (this.events.has(name)) {
      const existing_event = this.events.get(name) as DispatchedEvent;
      this.events.set(name, {
        ...existing_event,
        detail: existing_event.detail === undefined ? default_detail : existing_event.detail,
        description: existing_event.description || event_description,
      });
    } else {
      this.events.set(name, {
        type: "dispatched",
        name,
        detail: default_detail,
        description: event_description,
      });
    }
  }

  private parseCustomTypes() {
    commentParser.parse(this.source, { spacing: "preserve" }).forEach(({ tags, description: commentDescription }) => {
      let currentEventName: string | undefined;
      let currentEventType: string | undefined;
      let currentEventDescription: string | undefined;
      const eventProperties: Array<{
        name: string;
        type: string;
        description?: string;
        optional?: boolean;
        default?: string;
      }> = [];

      let currentTypedefName: string | undefined;
      let currentTypedefType: string | undefined;
      let currentTypedefDescription: string | undefined;
      const typedefProperties: Array<{
        name: string;
        type: string;
        description?: string;
        optional?: boolean;
        default?: string;
      }> = [];

      const finalizeEvent = () => {
        if (currentEventName !== undefined) {
          let detailType: string;
          if (eventProperties.length > 0) {
            detailType = this.buildEventDetailFromProperties(eventProperties, currentEventName);
          } else {
            detailType = currentEventType || "";
          }

          this.addDispatchedEvent({
            name: currentEventName,
            detail: detailType,
            has_argument: false,
            description: currentEventDescription,
          });
          this.eventDescriptions.set(currentEventName, currentEventDescription);
          eventProperties.length = 0;
          currentEventName = undefined;
          currentEventType = undefined;
          currentEventDescription = undefined;
        }
      };

      const finalizeTypedef = () => {
        if (currentTypedefName !== undefined) {
          let typedefType: string;
          let typedefTs: string;

          if (typedefProperties.length > 0) {
            // Build type alias with property descriptions
            typedefType = this.buildEventDetailFromProperties(typedefProperties);
            typedefTs = `type ${currentTypedefName} = ${typedefType}`;
          } else if (currentTypedefType) {
            // Use inline type definition (existing behavior)
            typedefType = currentTypedefType;
            typedefTs = /(\}|\};)$/.test(typedefType)
              ? `interface ${currentTypedefName} ${typedefType}`
              : `type ${currentTypedefName} = ${typedefType}`;
          } else {
            // No type or properties specified, default to empty object
            typedefType = "{}";
            typedefTs = `type ${currentTypedefName} = ${typedefType}`;
          }

          this.typedefs.set(currentTypedefName, {
            type: typedefType,
            name: currentTypedefName,
            description: ComponentParser.assignValue(currentTypedefDescription),
            ts: typedefTs,
          });

          typedefProperties.length = 0;
          currentTypedefName = undefined;
          currentTypedefType = undefined;
          currentTypedefDescription = undefined;
        }
      };

      tags.forEach(({ tag, type: tagType, name, description, optional, default: defaultValue }) => {
        const type = this.aliasType(tagType);

        switch (tag) {
          case "extends":
            this.extends = {
              interface: name,
              import: type,
            };
            break;
          case "restProps":
            this.rest_props = {
              type: "Element",
              name: type,
            };
            break;
          case "slot":
            this.addSlot({
              slot_name: name,
              slot_props: type,
              slot_description: description ? description : undefined,
            });
            break;
          case "event":
            // Finalize any previous event being built
            finalizeEvent();

            // Start tracking new event
            currentEventName = name;
            currentEventType = type;
            // Use the main comment description if available, otherwise use inline description
            currentEventDescription = commentDescription?.trim() || description || undefined;
            break;
          case "type":
            // Track the @type tag for the current event
            if (currentEventName !== undefined) {
              currentEventType = type;
            }
            break;
          case "property": {
            // Collect properties for the current event or typedef
            const propertyData = {
              name,
              type,
              description: description?.replace(/^-\s*/, "").trim(),
              optional: optional || false,
              default: defaultValue,
            };

            if (currentEventName !== undefined) {
              eventProperties.push(propertyData);
            } else if (currentTypedefName !== undefined) {
              typedefProperties.push(propertyData);
            }
            break;
          }
          case "typedef": {
            // Finalize any previous typedef being built
            finalizeTypedef();

            // Start tracking new typedef
            currentTypedefName = name;
            currentTypedefType = type;
            // Use inline description if present, otherwise use comment description
            const trimmedCommentDesc = commentDescription?.trim();
            currentTypedefDescription =
              description || (trimmedCommentDesc && trimmedCommentDesc !== "}" ? trimmedCommentDesc : undefined);
            break;
          }
          case "generics":
            this.generics = [name, type];
            break;
        }
      });

      // Finalize any remaining event or typedef
      finalizeEvent();
      finalizeTypedef();
    });
  }

  private buildEventDetailFromProperties(
    properties: Array<{ name: string; type: string; description?: string; optional?: boolean; default?: string }>,
  ): string {
    if (properties.length === 0) return "null";

    // Build inline object type with property descriptions as JSDoc comments
    const props = properties
      .map(({ name, type, description, optional, default: defaultValue }) => {
        const optionalMarker = optional ? "?" : "";
        let comment = description || "";

        // Add default value to description if present
        if (defaultValue && comment) {
          comment = `${comment} @default ${defaultValue}`;
        } else if (defaultValue) {
          comment = `@default ${defaultValue}`;
        }

        if (comment) {
          return `/** ${comment} */ ${name}${optionalMarker}: ${type};`;
        }
        return `${name}${optionalMarker}: ${type};`;
      })
      .join(" ");

    return `{ ${props} }`;
  }

  private generateContextTypeName(key: string): string {
    // Convert "simple-modal" -> "SimpleModalContext"
    // Convert "Tabs" -> "TabsContext"
    const parts = key.split(/[-_\s]+/);
    const capitalized = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
    return `${capitalized}Context`;
  }

  private findVariableTypeAndDescription(varName: string): { type: string; description?: string } | null {
    // Search through the source code directly for JSDoc comments
    if (!this.source) return null;

    // Build a map of variable names to their types by looking at the source
    const lines = this.source.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this line declares our variable
      // Match patterns like: const varName = ..., let varName = ..., function varName
      const constMatch = line.match(new RegExp(`const\\s+${varName}\\s*=`));
      const letMatch = line.match(new RegExp(`let\\s+${varName}\\s*=`));
      const funcMatch = line.match(new RegExp(`function\\s+${varName}\\s*\\(`));

      if (constMatch || letMatch || funcMatch) {
        // Look backwards for JSDoc comment
        for (let j = i - 1; j >= 0; j--) {
          const prevLine = lines[j].trim();

          // Stop if we hit a non-comment, non-empty line
          if (prevLine && !prevLine.startsWith("*") && !prevLine.startsWith("/*") && !prevLine.startsWith("//")) {
            break;
          }

          // Found start of JSDoc comment
          if (prevLine.startsWith("/**")) {
            // Extract the JSDoc comment block
            const commentLines: string[] = [];
            for (let k = j; k < i; k++) {
              commentLines.push(lines[k]);
            }
            const commentBlock = commentLines.join("\n");

            // Parse the JSDoc
            const parsed = commentParser.parse(commentBlock, { spacing: "preserve" });
            if (parsed[0]?.tags) {
              const typeTag = parsed[0].tags.find((t) => t.tag === "type");
              if (typeTag) {
                return {
                  type: this.aliasType(typeTag.type),
                  description: parsed[0].description || typeTag.description,
                };
              }
            }
            break;
          }
        }
      }
    }

    return null;
  }

  private parseContextValue(node: Node, key: string): ComponentContext | null {
    if (node.type === "ObjectExpression") {
      // Parse object literal: { open, close }
      const properties: ComponentContextProp[] = [];

      for (const prop of node.properties) {
        if (prop.type === "Property" || prop.type === "ObjectProperty") {
          const propName = prop.key.name || prop.key.value;

          // Try to find the variable definition to get its JSDoc type
          let propType = "any";
          let propDescription: string | undefined;

          if (prop.value.type === "Identifier") {
            const varName = prop.value.name;
            const varInfo = this.findVariableTypeAndDescription(varName);
            if (varInfo) {
              propType = varInfo.type;
              propDescription = varInfo.description;
            } else if (this.options?.verbose) {
              console.warn(`Warning: Context "${key}" property "${propName}" has no type annotation. Using "any".`);
            }
          } else if (prop.value.type === "ArrowFunctionExpression" || prop.value.type === "FunctionExpression") {
            // Inline function
            const params = prop.value.params.map((p) => `${p.name || "arg"}: any`).join(", ");
            propType = `(${params}) => any`;
          } else if (prop.value.type === "Literal") {
            // Literal value
            propType = typeof prop.value.value;
          }

          properties.push({
            name: propName,
            type: propType,
            description: propDescription,
            optional: false,
          });
        }
      }

      return {
        key,
        typeName: this.generateContextTypeName(key),
        properties,
        description: undefined,
      };
    } else if (node.type === "Identifier") {
      // setContext('key', someVariable)
      const varName = node.name;
      const varInfo = this.findVariableTypeAndDescription(varName);

      if (varInfo) {
        return {
          key,
          typeName: this.generateContextTypeName(key),
          properties: [
            {
              name: varName,
              type: varInfo.type,
              description: varInfo.description,
              optional: false,
            },
          ],
        };
      } else if (this.options?.verbose) {
        console.warn(`Warning: Context "${key}" variable "${varName}" has no type annotation. Using "any".`);
      }

      // Still create context with 'any' type
      return {
        key,
        typeName: this.generateContextTypeName(key),
        properties: [
          {
            name: varName,
            type: "any",
            description: undefined,
            optional: false,
          },
        ],
      };
    }

    return null;
  }

  private parseSetContextCall(node: Node) {
    // Extract context key (first argument)
    const keyArg = node.arguments[0];
    if (!keyArg) return;

    let contextKey: string | null = null;
    if (keyArg.type === "Literal") {
      contextKey = keyArg.value;
    } else if (keyArg.type === "TemplateLiteral") {
      // Handle simple template literals
      if (keyArg.quasis?.length === 1) {
        contextKey = keyArg.quasis[0].value.cooked;
      } else if (this.options?.verbose) {
        console.warn("Warning: Skipping setContext with dynamic template literal key");
      }
    } else if (this.options?.verbose) {
      console.warn(`Warning: Skipping setContext with non-literal key (type: ${keyArg.type})`);
    }

    if (!contextKey) return;

    // Extract context value (second argument)
    const valueArg = node.arguments[1];
    if (!valueArg) return;

    // Parse the context object
    const contextInfo = this.parseContextValue(valueArg, contextKey);
    if (contextInfo) {
      // Check if context with same key already exists
      if (this.contexts.has(contextKey)) {
        if (this.options?.verbose) {
          console.warn(`Warning: Multiple setContext calls with key "${contextKey}". Using first occurrence.`);
        }
      } else {
        this.contexts.set(contextKey, contextInfo);
      }
    }
  }

  public cleanup() {
    this.source = undefined;
    this.compiled = undefined;
    this.parsed = undefined;
    this.rest_props = undefined;
    this.extends = undefined;
    this.componentComment = undefined;
    this.reactive_vars.clear();
    this.props.clear();
    this.moduleExports.clear();
    this.slots.clear();
    this.events.clear();
    this.eventDescriptions.clear();
    this.forwardedEvents.clear();
    this.typedefs.clear();
    this.generics = null;
    this.bindings.clear();
    this.contexts.clear();
  }

  /**
   * Strips TypeScript directive comments from script blocks only.
   */
  private static stripTypeScriptDirectivesFromScripts(source: string): string {
    // Find all script blocks and strip directives only from within them
    return source.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi, (_match, openTag, scriptContent, closeTag) => {
      // Remove TypeScript directives from script content only
      const cleanedContent = scriptContent.replace(/\/\/\s*@ts-[^\n\r]*/g, "");
      return openTag + cleanedContent + closeTag;
    });
  }

  public parseSvelteComponent(source: string, diagnostics: ComponentParserDiagnostics): ParsedComponent {
    if (this.options?.verbose) {
      console.log(`[parsing] "${diagnostics.moduleName}" ${diagnostics.filePath}`);
    }

    this.cleanup();
    // Strip TypeScript directives from script blocks only to prevent interference with JSDoc
    const cleanedSource = ComponentParser.stripTypeScriptDirectivesFromScripts(source);
    this.source = cleanedSource;
    this.compiled = compile(cleanedSource);
    this.parsed = parse(cleanedSource);
    this.collectReactiveVars();
    this.parseCustomTypes();

    if (this.parsed?.module) {
      walk(this.parsed?.module as unknown as Node, {
        enter: (node) => {
          if (node.type === "ExportNamedDeclaration") {
            const {
              type: declaration_type,
              id,
              init,
              body,
            } = node.declaration?.declarations ? node.declaration.declarations[0] : node.declaration;

            const prop_name = id.name;
            let value: string | undefined;
            let type: string | undefined;
            let kind = node.declaration.kind;
            let description: string | undefined;
            let isFunction = false;
            let isFunctionDeclaration = false;

            if (init != null) {
              if (
                init.type === "ObjectExpression" ||
                init.type === "BinaryExpression" ||
                init.type === "ArrayExpression" ||
                init.type === "ArrowFunctionExpression"
              ) {
                value = this.sourceAtPos(init.start, init.end)?.replace(/[\r\n]+/g, " ");
                type = value;
                isFunction = init.type === "ArrowFunctionExpression";

                if (init.type === "BinaryExpression") {
                  if (init?.left.type === "Literal" && typeof init?.left.value === "string") {
                    type = "string";
                  }
                }
              } else {
                if (init.type === "UnaryExpression") {
                  value = this.sourceAtPos(init.start, init.end);
                  type = typeof init.argument?.value;
                } else if (init.type === "Identifier") {
                  // Handle non-literal defaults like variable references and global identifiers.
                  // Don't infer type, just preserve existing type annotation.
                  value = this.sourceAtPos(init.start, init.end);
                } else {
                  value = init.raw;
                  type = init.value == null ? undefined : typeof init.value;
                }
              }
            }

            if (declaration_type === "FunctionDeclaration") {
              value = `() => ${this.sourceAtPos(body.start, body.end)?.replace(/[\r\n]+/g, " ")}`;
              type = "() => any";
              kind = "function";
              isFunction = true;
              isFunctionDeclaration = true;
            }

            if (node.leadingComments) {
              const jsdoc_comment = ComponentParser.findJSDocComment(node.leadingComments);
              if (jsdoc_comment) {
                const comment = commentParser.parse(ComponentParser.formatComment(jsdoc_comment.value), {
                  spacing: "preserve",
                });
                const tag = comment[0]?.tags[comment[0]?.tags.length - 1];
                if (tag?.tag === "type") type = this.aliasType(tag.type);
                description = ComponentParser.assignValue(comment[0]?.description?.trim());
              }
            }

            if (!description && this.typedefs.has(type)) {
              description = this.typedefs.get(type)?.description;
            }

            this.addModuleExport(prop_name, {
              name: prop_name,
              kind,
              description,
              type,
              value,
              isFunction,
              isFunctionDeclaration,
              isRequired: false,
              constant: kind === "const",
              reactive: false,
            });
          }
        },
      });
    }

    let dispatcher_name: undefined | string;
    const callees: { name: string; arguments: Expression[] }[] = [];

    walk({ html: this.parsed.html, instance: this.parsed.instance } as unknown as Node, {
      enter: (node, parent, _prop) => {
        if (node.type === "CallExpression") {
          if (node.callee.name === "createEventDispatcher") {
            dispatcher_name = parent?.id.name;
          }

          if (node.callee.name === "setContext") {
            this.parseSetContextCall(node, parent);
          }

          callees.push({
            name: node.callee.name,
            arguments: node.arguments,
          });
        }

        if (node.type === "Spread" && node?.expression.name === "$$restProps") {
          if (this.rest_props === undefined && (parent?.type === "InlineComponent" || parent?.type === "Element")) {
            this.rest_props = {
              type: parent.type,
              name: parent.name,
            };
          }
        }

        if (node.type === "VariableDeclaration") {
          this.vars.add(node as unknown as VariableDeclaration);
        }

        if (node.type === "ExportNamedDeclaration") {
          // Handle export {}
          if (node.declaration == null && node.specifiers.length === 0) {
            return;
          }

          // Handle renamed exports
          let prop_name: string;
          if (node.declaration == null && node.specifiers[0]?.type === "ExportSpecifier") {
            const specifier = node.specifiers[0];
            const localName = specifier.local.name,
              exportedName = specifier.exported.name;
            let declaration: VariableDeclaration;
            // Search through all variable declarations for this variable
            //  Limitation: the variable must have been declared before the export
            this.vars.forEach((varDecl) => {
              if (varDecl.declarations.some((decl) => decl.id.type === "Identifier" && decl.id.name === localName)) {
                declaration = varDecl;
              }
            });
            node.declaration = declaration;
            prop_name = exportedName;
          }

          const {
            type: declaration_type,
            id,
            init,
            body,
          } = node.declaration.declarations ? node.declaration.declarations[0] : node.declaration;

          prop_name ??= id.name;

          let value: string | undefined;
          let type: string | undefined;
          let kind = node.declaration.kind;
          let description: undefined | string;
          let isFunction = false;
          let isFunctionDeclaration = false;
          const isRequired = kind === "let" && init == null;

          if (init != null) {
            if (
              init.type === "ObjectExpression" ||
              init.type === "BinaryExpression" ||
              init.type === "ArrayExpression" ||
              init.type === "ArrowFunctionExpression"
            ) {
              value = this.sourceAtPos(init.start, init.end)?.replace(/[\r\n]+/g, " ");
              type = value;
              isFunction = init.type === "ArrowFunctionExpression";

              if (init.type === "BinaryExpression") {
                if (init?.left.type === "Literal" && typeof init?.left.value === "string") {
                  type = "string";
                }
              }
            } else {
              if (init.type === "UnaryExpression") {
                value = this.sourceAtPos(init.start, init.end);
                type = typeof init.argument?.value;
              } else if (init.type === "Identifier") {
                // Handle non-literal defaults like variable references and global identifiers.
                // Don't infer type, just preserve existing type annotation.
                value = this.sourceAtPos(init.start, init.end);
              } else {
                value = init.raw;
                type = init.value == null ? undefined : typeof init.value;
              }
            }
          }

          if (declaration_type === "FunctionDeclaration") {
            value = `() => ${this.sourceAtPos(body.start, body.end)?.replace(/[\r\n]+/g, " ")}`;
            type = "() => any";
            kind = "function";
            isFunction = true;
            isFunctionDeclaration = true;
          }

          if (node.leadingComments) {
            const jsdoc_comment = ComponentParser.findJSDocComment(node.leadingComments);
            if (jsdoc_comment) {
              const comment = commentParser.parse(ComponentParser.formatComment(jsdoc_comment.value), {
                spacing: "preserve",
              });

              const tag = comment[0]?.tags[comment[0]?.tags.length - 1];
              if (tag?.tag === "type") type = this.aliasType(tag.type);
              description = ComponentParser.assignValue(comment[0]?.description?.trim());

              const additional_tags =
                comment[0]?.tags.filter(
                  (tag) => !["type", "extends", "restProps", "slot", "event", "typedef"].includes(tag.tag),
                ) ?? [];

              if (additional_tags.length > 0 && description === undefined) {
                description = "";
              }

              additional_tags.forEach((tag) => {
                description += `${description ? "\n" : ""}@${tag.tag} ${tag.name}${
                  tag.description ? ` ${tag.description}` : ""
                }`;
              });
            }
          }

          if (!description && this.typedefs.has(type)) {
            description = this.typedefs.get(type)?.description;
          }

          this.addProp(prop_name, {
            name: prop_name,
            kind,
            description,
            type,
            value,
            isFunction,
            isFunctionDeclaration,
            isRequired,
            constant: kind === "const",
            reactive: this.reactive_vars.has(prop_name),
          });
        }

        if (node.type === "Comment") {
          const data: string = node?.data?.trim() ?? "";

          if (/^@component/.test(data)) {
            this.componentComment = data.replace(/^@component/, "").replace(/\r/g, "");
          }
        }

        if (node.type === "Slot") {
          const slot_name = node.attributes.find((attr: { name?: string }) => attr.name === "name")?.value[0].data;

          const slot_props = node.attributes
            .filter((attr: { name?: string }) => attr.name !== "name")
            .reduce((slot_props: SlotProps, { name, value }: { name: string; value?: Expression[] }) => {
              const slot_prop_value: SlotPropValue = {
                value: undefined,
                replace: false,
              };

              if (value === undefined) return slot_props;

              if (value[0]) {
                const { type, expression, raw, start, end } = value[0];

                if (type === "Text") {
                  slot_prop_value.value = raw;
                } else if (type === "AttributeShorthand") {
                  slot_prop_value.value = expression.name;
                  slot_prop_value.replace = true;
                }

                if (expression) {
                  if (expression.type === "Literal") {
                    slot_prop_value.value = expression.value;
                  } else if (expression.type !== "Identifier") {
                    if (expression.type === "ObjectExpression" || expression.type === "TemplateLiteral") {
                      slot_prop_value.value = this.sourceAtPos(start + 1, end - 1);
                    } else {
                      slot_prop_value.value = this.sourceAtPos(start, end);
                    }
                  }
                }
              }

              slot_props[name] = slot_prop_value;
              return slot_props;
            }, {});

          const fallback = (node.children as TemplateNode[])
            ?.map(({ start, end }) => this.sourceAtPos(start, end))
            .join("")
            .trim();

          this.addSlot({
            slot_name,
            slot_props: JSON.stringify(slot_props, null, 2),
            slot_fallback: fallback,
          });
        }

        if (node.type === "EventHandler" && node.expression == null) {
          if (parent !== undefined) {
            // Track that this event is forwarded (we'll use this info later)
            this.forwardedEvents.set(node.name, parent.name);

            const existing_event = this.events.get(node.name);

            // Check if this event has a JSDoc description
            const description = this.eventDescriptions.get(node.name);
            const event_description = description?.split("-").pop()?.trim();

            if (!existing_event) {
              // Add new forwarded event
              this.events.set(node.name, {
                type: "forwarded",
                name: node.name,
                element: parent.name,
                description: event_description,
              });
            } else if (existing_event.type === "forwarded" && event_description && !existing_event.description) {
              // Event is already forwarded, just add the description
              this.events.set(node.name, {
                ...existing_event,
                description: event_description,
              });
            }
            // Note: if event is dispatched, we don't overwrite it here
            // We'll handle @event JSDoc on forwarded events after the walk completes
          }
        }

        if (parent?.type === "Element" && node.type === "Binding" && node.name === "this") {
          const prop_name = node.expression.name;
          const element_name = parent.name;

          if (this.bindings.has(prop_name)) {
            const existing_bindings = this.bindings.get(prop_name);

            if (!existing_bindings.elements.includes(element_name)) {
              this.bindings.set(prop_name, {
                ...existing_bindings,
                elements: [...existing_bindings.elements, element_name],
              });
            }
          } else {
            this.bindings.set(prop_name, {
              elements: [element_name],
            });
          }
        }
      },
    });

    if (dispatcher_name !== undefined) {
      callees.forEach((callee) => {
        if (callee.name === dispatcher_name) {
          const event_name = callee.arguments[0]?.value;
          const event_argument = callee.arguments[1];
          const event_detail = event_argument?.value;

          this.addDispatchedEvent({
            name: event_name,
            detail: event_detail,
            has_argument: Boolean(event_argument),
          });
        }
      });
    }

    // Post-process events: convert dispatched events from @event JSDoc to forwarded events
    // if they are actually forwarded and not dispatched via createEventDispatcher
    const actuallyDispatchedEvents = new Set<string>();
    if (dispatcher_name !== undefined) {
      callees.forEach((callee) => {
        if (callee.name === dispatcher_name) {
          actuallyDispatchedEvents.add(callee.arguments[0]?.value);
        }
      });
    }

    this.forwardedEvents.forEach((element, eventName) => {
      const event = this.events.get(eventName);
      // If event is marked as dispatched but is NOT actually dispatched, convert it to forwarded
      if (event && event.type === "dispatched" && !actuallyDispatchedEvents.has(eventName)) {
        const description = this.eventDescriptions.get(eventName);
        const event_description = description?.split("-").pop()?.trim();
        const forwardedEvent: ForwardedEvent = {
          type: "forwarded",
          name: eventName,
          element: element,
          description: event_description,
        };
        // Preserve detail type if it was explicitly set in @event tag
        // Note: "null" is a valid explicit type (e.g., @event {null} eventname)
        // Only skip if detail is truly undefined or the string "undefined"
        if (event.detail !== undefined && event.detail !== "undefined") {
          forwardedEvent.detail = event.detail;
        }
        this.events.set(eventName, forwardedEvent);
      }
    });

    return {
      props: ComponentParser.mapToArray(this.props).map((prop) => {
        if (this.bindings.has(prop.name)) {
          return {
            ...prop,
            type:
              "null | " +
              this.bindings
                .get(prop.name)
                ?.elements.sort()
                .map((element) => getElementByTag(element))
                .join(" | "),
          };
        }

        return prop;
      }),
      moduleExports: ComponentParser.mapToArray(this.moduleExports),
      slots: ComponentParser.mapToArray(this.slots)
        .map((slot) => {
          try {
            const slot_props: SlotProps = JSON.parse(slot.slot_props);
            const new_props: string[] = [];

            Object.keys(slot_props).forEach((key) => {
              if (slot_props[key].replace && slot_props[key].value !== undefined) {
                slot_props[key].value = this.props.get(slot_props[key].value)?.type;
              }

              if (slot_props[key].value === undefined) slot_props[key].value = "any";
              new_props.push(`${key}: ${slot_props[key].value}`);
            });

            const formatted_slot_props =
              new_props.length === 0 ? "Record<string, never>" : `{ ${new_props.join(", ")} }`;

            return { ...slot, slot_props: formatted_slot_props };
          } catch (_e) {
            return slot;
          }
        })
        .sort((a, b) => {
          if (a.name < b.name) return -1;
          if (a.name > b.name) return 1;
          return 0;
        }),
      events: ComponentParser.mapToArray(this.events),
      typedefs: ComponentParser.mapToArray(this.typedefs),
      generics: this.generics,
      rest_props: this.rest_props,
      extends: this.extends,
      componentComment: this.componentComment,
      contexts: ComponentParser.mapToArray(this.contexts),
    };
  }
}
