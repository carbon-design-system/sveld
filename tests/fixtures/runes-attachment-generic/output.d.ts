import { SvelteComponentTyped } from "svelte";
import type { Attachment } from "svelte/attachments";

type $Props<Element extends HTMLElement = HTMLDivElement> = { measure?: Attachment<Element> };

export type RunesAttachmentGenericProps<Element extends HTMLElement = HTMLDivElement> = $Props<Element>;

export default class RunesAttachmentGeneric<Element extends HTMLElement = HTMLDivElement> extends SvelteComponentTyped<
  RunesAttachmentGenericProps<Element>,
  Record<string, any>,
  Record<string, never>
> {}
