import { SvelteComponentTyped } from "svelte";
import type { Attachment } from "svelte/attachments";

type $Props = { onmount?: Attachment };

export type RunesAttachmentPropProps = $Props;

export default class RunesAttachmentProp extends SvelteComponentTyped<
  RunesAttachmentPropProps,
  Record<string, any>,
  Record<string, never>
> {}
