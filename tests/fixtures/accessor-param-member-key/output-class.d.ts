import { SvelteComponentTyped } from "svelte";

export type AccessorParamMemberKeyProps = Record<string, never>;

export default class AccessorParamMemberKey extends SvelteComponentTyped<
  AccessorParamMemberKeyProps,
  Record<string, any>,
  Record<string, never>
> {
  /**
   * Label a control.
   */
  label: (attributes: {
      id: string;
      "aria-label"?: string
    }) => void;
}
