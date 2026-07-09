import type { Component } from "svelte";
import type { Attachment } from "svelte/attachments";

type $Props = { createTooltip?: (text: string) => Attachment };

export type RunesAttachmentFactoryProps = $Props;

export type RunesAttachmentFactoryExports = Record<string, never>;

declare const RunesAttachmentFactory: Component<
  RunesAttachmentFactoryProps,
  RunesAttachmentFactoryExports,
  ""
>;
export default RunesAttachmentFactory;
