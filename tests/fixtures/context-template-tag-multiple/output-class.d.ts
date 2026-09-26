import { SvelteComponentTyped } from "svelte";

export type DemoWrapperContext<Value extends string = string, Icon = any> = {
  selectedValue: import("svelte/store").Writable<Value | undefined>;
  icon: Icon;
};

export type ContextTemplateTagMultipleProps<Value extends string = string, Icon = any> = {
  selected?: Value | undefined;

  icon?: Icon;

  children?: (this: void) => void;
};

export default class ContextTemplateTagMultiple<Value extends string = string, Icon = any> extends SvelteComponentTyped<
  ContextTemplateTagMultipleProps<Value, Icon>,
  Record<string, any>,
  { default: Record<string, never> }
> {}
