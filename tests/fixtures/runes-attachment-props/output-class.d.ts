import { SvelteComponentTyped } from "svelte";
import type { Attachment } from "svelte/attachments";

type $Props = {
  onmount?: Attachment;
  createTooltip?: (text: string) => Attachment;
  attachments?: Attachment[];
};

export type RunesAttachmentPropsProps = $Props;

export default class RunesAttachmentProps extends SvelteComponentTyped<
  RunesAttachmentPropsProps,
  Record<string, any>,
  Record<string, never>
> {}
