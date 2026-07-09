import type { Component } from "svelte";
import type { Attachment } from "svelte/attachments";

type $Props = { attachments?: Attachment[] };

export type RunesAttachmentArrayProps = $Props;

export type RunesAttachmentArrayExports = Record<string, never>;

declare const RunesAttachmentArray: Component<
  RunesAttachmentArrayProps,
  RunesAttachmentArrayExports,
  ""
>;
export default RunesAttachmentArray;
