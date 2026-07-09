import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
import type { Attachment } from "svelte/attachments";

type $Props<Element extends HTMLElement = HTMLDivElement> = { measure?: Attachment<Element> };

export type RunesAttachmentGenericProps<Element extends HTMLElement = HTMLDivElement> = $Props<Element>;

export type RunesAttachmentGenericExports = Record<string, never>;

interface RunesAttachmentGenericComponent {
  new <Element extends HTMLElement = HTMLDivElement>(
    options: ComponentConstructorOptions<RunesAttachmentGenericProps<Element>>
  ): SvelteComponent<RunesAttachmentGenericProps<Element>> & RunesAttachmentGenericExports;
  <Element extends HTMLElement = HTMLDivElement>(
    this: void,
    internals: ComponentInternals,
    props: RunesAttachmentGenericProps<Element>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RunesAttachmentGenericProps<Element>>): void;
  } & RunesAttachmentGenericExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesAttachmentGeneric: RunesAttachmentGenericComponent;
export default RunesAttachmentGeneric;
