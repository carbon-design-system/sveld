import { compile, walk } from "svelte/compiler";
import * as commentParser from "comment-parser";
import { Ast, TemplateNode, Var } from "svelte/types/compiler/interfaces";
import { getElementByTag } from "./element-tag-map";

declare module "svelte/compiler" {
  interface Visitor {
    enter?: (node: TemplateNode, parent: any, prop: any) => void;
  }

  export const walk: (ast: Ast, visitor?: Visitor) => void;
}

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
  value?: any;
  description?: string;
  isFunction: boolean;
  reactive: boolean;
}

const DEFAULT_SLOT_NAME = "__default__";

type ComponentSlotName = typeof DEFAULT_SLOT_NAME | string;

interface ComponentSlot {
  name?: string;
  default: boolean;
  fallback?: string;
  slot_props?: string;
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
}

interface DispatchedEvent {
  type: "dispatched";
  name: string;
  detail?: any;
}

type ComponentEvent = ForwardedEvent | DispatchedEvent;

type TypeDefName = string;

interface TypeDef extends Pick<commentParser.Tag, "type" | "name"> {
  description?: string;
  ts: string;
}

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

export interface ParsedComponent {
  props: ComponentProp[];
  slots: ComponentSlot[];
  events: ComponentEvent[];
  typedefs: TypeDef[];
  rest_props: RestProps;
  extends?: Extends;
}

export default class ComponentParser {
  private options?: ComponentParserOptions;
  private source?: string;
  private compiled?: CompiledSvelteCode;
  private rest_props?: RestProps;
  private extends?: Extends;
  private readonly reactive_vars: Set<string> = new Set();
  private readonly props: Map<ComponentPropName, ComponentProp> = new Map();
  private readonly slots: Map<ComponentSlotName, ComponentSlot> = new Map();
  private readonly events: Map<ComponentEventName, ComponentEvent> = new Map();
  private readonly typedefs: Map<TypeDefName, TypeDef> = new Map();
  private readonly bindings: Map<ComponentPropName, ComponentPropBindings> = new Map();

  constructor(options?: ComponentParserOptions) {
    this.options = options;
  }

  private static mapToArray(map: Map<any, any>) {
    return Array.from(map, ([key, value]) => value);
  }

  private static assignValue(value?: "" | string) {
    return value === undefined || value === "" ? undefined : value;
  }

  private static formatComment(comment: string) {
    let formatted_comment = comment;

    if (!formatted_comment.startsWith("/*")) {
      formatted_comment = "/*" + formatted_comment;
    }

    if (!formatted_comment.endsWith("*/")) {
      formatted_comment += "*/";
    }

    return formatted_comment;
  }

  private sourceAtPos(start: number, end: number) {
    return this.source?.slice(start, end);
  }

  private collectReactiveVars() {
    this.compiled?.vars
      .filter(({ reassigned, writable }) => reassigned && writable)
      .forEach(({ name }) => this.reactive_vars.add(name));
  }

  private addProp(prop_name: string, data: ComponentProp) {
    if (ComponentParser.assignValue(prop_name) === undefined) return;

    if (this.props.has(prop_name)) {
      const existing_slot = this.props.get(prop_name)!;

      this.props.set(prop_name, {
        ...existing_slot,
        ...data,
      });
    } else {
      this.props.set(prop_name, data);
    }
  }

  private aliasType(type: any) {
    if (type === "*") return "any";
    return type;
  }

  private addSlot(slot_name?: string, slot_props?: string, slot_fallback?: string) {
    const default_slot = slot_name === undefined || slot_name === "";
    const name: ComponentSlotName = default_slot ? DEFAULT_SLOT_NAME : slot_name!;
    const fallback = ComponentParser.assignValue(slot_fallback);
    const props = ComponentParser.assignValue(slot_props);

    if (this.slots.has(name)) {
      const existing_slot = this.slots.get(name)!;

      this.slots.set(name, {
        ...existing_slot,
        fallback,
        slot_props: existing_slot.slot_props === undefined ? props : existing_slot.slot_props,
      });
    } else {
      this.slots.set(name, {
        name,
        default: default_slot,
        fallback,
        slot_props,
      });
    }
  }

  private addDispatchedEvent(name?: string, detail?: string) {
    if (name === undefined) return;
    if (this.events.has(name)) {
      const existing_event = this.events.get(name) as DispatchedEvent;

      this.events.set(name, {
        ...existing_event,
        detail: existing_event.detail === undefined ? ComponentParser.assignValue(detail) : existing_event.detail,
      });
    } else {
      this.events.set(name, {
        type: "dispatched",
        name,
        detail: ComponentParser.assignValue(detail),
      });
    }
  }

  private parseCustomTypes() {
    commentParser(this.source!).forEach(({ tags }) => {
      tags.forEach(({ tag, type: tagType, name, description }) => {
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
            this.addSlot(name, type);
            break;
          case "event":
            this.addDispatchedEvent(name, type);
            break;
          case "typedef":
            this.typedefs.set(name, {
              type,
              name,
              description: ComponentParser.assignValue(description),
              ts: /(\}|\};)$/.test(type) ? `interface ${name} ${type}` : `type ${name} = ${type}`,
            });
            break;
        }
      });
    });
  }

  public cleanup() {
    this.source = undefined;
    this.compiled = undefined;
    this.rest_props = undefined;
    this.extends = undefined;
    this.reactive_vars.clear();
    this.props.clear();
    this.slots.clear();
    this.events.clear();
    this.typedefs.clear();
    this.bindings.clear();
  }

  public parseSvelteComponent(source: string, diagnostics: ComponentParserDiagnostics): ParsedComponent {
    if (this.options?.verbose) {
      process.stdout.write(`[parsing] "${diagnostics.moduleName}" ${diagnostics.filePath}\n`);
    }

    this.cleanup();
    this.source = source;
    this.compiled = compile(source);
    this.collectReactiveVars();
    this.parseCustomTypes();

    let dispatcher_name: undefined | string = undefined;
    let callees: { name: string; arguments: any }[] = [];

    walk(this.compiled.ast, {
      enter: (node, parent, prop) => {
        if (node.type === "CallExpression") {
          if (node.callee.name === "createEventDispatcher") {
            dispatcher_name = parent.id.name;
          }

          callees.push({
            name: node.callee.name,
            arguments: node.arguments,
          });
        }

        if (node.type === "Spread" && node?.expression.name === "$$restProps") {
          if (this.rest_props === undefined) {
            this.rest_props = {
              type: parent.type,
              name: parent.name,
            };
          }
        }

        if (node.type === "ExportNamedDeclaration") {
          const { type: declaration_type, id, init, body } = node.declaration.declarations
            ? node.declaration.declarations[0]
            : node.declaration;

          const prop_name = id.name;

          let value = undefined;
          let type = undefined;
          let kind = node.declaration.kind;
          let description = undefined;
          let isFunction = false;

          if (init != null) {
            if (
              init.type === "ObjectExpression" ||
              init.type === "BinaryExpression" ||
              init.type === "ArrayExpression" ||
              init.type === "ArrowFunctionExpression"
            ) {
              value = this.sourceAtPos(init.start, init.end)?.replace(/\n/g, " ");
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
              } else {
                value = init.raw;
                type = init.value == null ? undefined : typeof init.value;
              }
            }
          }

          if (declaration_type === "FunctionDeclaration") {
            value = "() => " + this.sourceAtPos(body.start, body.end)?.replace(/\n/g, " ");
            type = "() => any";
            isFunction = true;
            kind = "function";
          }

          if (node.leadingComments) {
            const last_comment = node.leadingComments[node.leadingComments.length - 1];
            const comment = commentParser(ComponentParser.formatComment(last_comment.value));
            const tag = comment[0]?.tags[comment[0]?.tags.length - 1];
            if (tag?.tag === "type") type = this.aliasType(tag.type);
            description = ComponentParser.assignValue(comment[0]?.description);
          }

          if (!description && this.typedefs.has(type)) {
            description = this.typedefs.get(type)!.description;
          }

          this.addProp(prop_name, {
            name: prop_name,
            kind,
            description,
            type,
            value,
            isFunction,
            constant: kind === "const",
            reactive: this.reactive_vars.has(prop_name),
          });
        }

        if (node.type === "Slot") {
          const slot_name = node.attributes.find((attr: any) => attr.name === "name")?.value[0].data;

          const slot_props = node.attributes
            .filter((attr: { name?: string }) => attr.name !== "name")
            .reduce((slot_props: SlotProps, { name, value }: { name: string; value?: any }) => {
              let slot_prop_value: SlotPropValue = {
                value: undefined,
                replace: false,
              };

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

              return { ...slot_props, [name]: slot_prop_value };
            }, {});

          const fallback = node.children
            ?.map(({ start, end }) => this.sourceAtPos(start, end))
            .join("")
            .trim();

          this.addSlot(slot_name, JSON.stringify(slot_props, null, 2), fallback);
        }

        if (node.type === "EventHandler" && node.expression == null) {
          if (!this.events.has(node.name)) {
            this.events.set(node.name, {
              type: "forwarded",
              name: node.name,
              element: parent.name,
            });
          }
        }

        if (parent?.type === "Element" && node.type === "Binding" && node.name === "this") {
          const prop_name = node.expression.name;
          const element_name = parent.name;

          if (this.bindings.has(prop_name)) {
            const existing_bindings = this.bindings.get(prop_name)!;

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
          const event_detail = callee.arguments[1]?.value;

          this.addDispatchedEvent(event_name, event_detail);
        }
      });
    }

    return {
      props: ComponentParser.mapToArray(this.props).map((prop) => {
        if (this.bindings.has(prop.name)) {
          return {
            ...prop,
            type:
              "null | " +
              this.bindings
                .get(prop.name)!
                .elements.sort()
                .map((element) => getElementByTag(element))
                .join(" | "),
          };
        }

        return prop;
      }),
      slots: ComponentParser.mapToArray(this.slots)
        .map((slot) => {
          try {
            const slot_props: SlotProps = JSON.parse(slot.slot_props);
            const new_props: string[] = [];

            Object.keys(slot_props).forEach((key) => {
              if (slot_props[key].replace && slot_props[key].value !== undefined) {
                slot_props[key].value = this.props.get(slot_props[key].value!)?.type;
              }

              if (slot_props[key].value === undefined) slot_props[key].value = "any";
              new_props.push(`${key}: ${slot_props[key].value}`);
            });

            const formatted_slot_props = new_props.length === 0 ? "{}" : "{ " + new_props.join(", ") + " }";

            return { ...slot, slot_props: formatted_slot_props };
          } catch (e) {
            return slot;
          }
        })
        .sort((a, b) => {
          if (a.name! < b.name!) return -1;
          if (a.name! > b.name) return 1;
          return 0;
        }),
      events: ComponentParser.mapToArray(this.events),
      typedefs: ComponentParser.mapToArray(this.typedefs),
      rest_props: this.rest_props,
      extends: this.extends,
    };
  }
}
