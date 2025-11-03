import type { SvelteComponentTyped } from "svelte";

export type NoPropsProps = Record<string, never>;

export default class NoProps extends SvelteComponentTyped<NoPropsProps, Record<string, any>, Record<string, never>> {}
