/// <reference types="svelte" />
import { ButtonProps } from "./Button";

export interface SecondaryButtonProps extends ButtonProps, svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["button"]> {}

export default class SecondaryButton {
  $$prop_def: SecondaryButtonProps;
  $$slot_def: {
    default: {};
  };

  $on(eventname: "click", cb: (event: WindowEventMap["click"]) => void): () => void;
  $on(eventname: string, cb: (event: Event) => void): () => void;
}
