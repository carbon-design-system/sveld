import type { Component } from "svelte";

export type AccessorParamMemberKeyProps = Record<string, never>;

export type AccessorParamMemberKeyExports = {
  /**
   * Label a control.
   */
  label: (attributes: {
      id: string;
      "aria-label"?: string
    }) => void;
};

declare const AccessorParamMemberKey: Component<
  AccessorParamMemberKeyProps,
  AccessorParamMemberKeyExports,
  ""
>;
export default AccessorParamMemberKey;
