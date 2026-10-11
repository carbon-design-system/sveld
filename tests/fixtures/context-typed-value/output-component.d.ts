import type { Component } from "svelte";

export type ModalAPI = {
  open: () => void;
  close: () => void;
};

/**
 * Log a message to the console
 */
export type MyLoggerContext = (message: string) => void;

/**
 * Modal API object
 */
export type ModalContext = ModalAPI;

export type ContextTypedValueProps = {
  children?: (this: void) => void;
};

export type ContextTypedValueExports = Record<string, never>;

declare const ContextTypedValue: Component<
  ContextTypedValueProps,
  ContextTypedValueExports,
  ""
>;
export default ContextTypedValue;
