import { SvelteComponentTyped } from "svelte";
import type { Attachment } from "svelte/attachments";

type $Props = { measure?: (node: HTMLElement) => Attachment };

export type RunesCallbackPropTsTypeNoDefaultProps = $Props;

export default class RunesCallbackPropTsTypeNoDefault extends SvelteComponentTyped<
  RunesCallbackPropTsTypeNoDefaultProps,
  Record<string, any>,
  Record<string, never>
> {}
