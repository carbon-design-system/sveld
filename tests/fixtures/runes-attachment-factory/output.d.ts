import { SvelteComponentTyped } from "svelte";
import type { Attachment } from "svelte/attachments";

type $Props = { createTooltip?: (text: string) => Attachment };

export type RunesAttachmentFactoryProps = $Props;

export default class RunesAttachmentFactory extends SvelteComponentTyped<
  RunesAttachmentFactoryProps,
  Record<string, any>,
  Record<string, never>
> {}
