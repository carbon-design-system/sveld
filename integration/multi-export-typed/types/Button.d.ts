/// <reference types="svelte" />

export interface ButtonProps extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["button"]> {
  /**
   * @default "button"
   */
  type?: "button" | "submit" | "reset";

  /**
   * Set to `true` to use the primary variant
   * @default false
   */
  primary?: boolean;
}

export default class Button {
  $$prop_def: ButtonProps;
  $$slot_def: {
    default: {};
  };

  $on(eventname: "click", cb: (event: WindowEventMap["click"]) => void): () => void;
  $on(eventname: string, cb: (event: Event) => void): () => void;
}
