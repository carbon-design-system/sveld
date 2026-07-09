import type { Component } from "svelte";
import type { Attachment } from "svelte/attachments";

type $Props = { onmount?: Attachment };

export type RunesAttachmentPropProps = $Props;

export type RunesAttachmentPropExports = Record<string, never>;

declare const RunesAttachmentProp: Component<
  RunesAttachmentPropProps,
  RunesAttachmentPropExports,
  ""
>;
export default RunesAttachmentProp;
