import type { Component } from "svelte";
import type { Attachment } from "svelte/attachments";

type $Props = {
  onmount?: Attachment;
  createTooltip?: (text: string) => Attachment;
  attachments?: Attachment[];
};

export type RunesAttachmentPropsProps = $Props;

export type RunesAttachmentPropsExports = Record<string, never>;

declare const RunesAttachmentProps: Component<
  RunesAttachmentPropsProps,
  RunesAttachmentPropsExports,
  ""
>;
export default RunesAttachmentProps;
