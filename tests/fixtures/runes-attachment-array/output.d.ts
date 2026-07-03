import { SvelteComponentTyped } from "svelte";
import type { Attachment } from "svelte/attachments";

type $Props = { attachments?: Attachment[] };

export type RunesAttachmentArrayProps = $Props;

export default class RunesAttachmentArray extends SvelteComponentTyped<
  RunesAttachmentArrayProps,
  Record<string, any>,
  Record<string, never>
> {}
