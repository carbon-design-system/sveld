import { SvelteComponentTyped } from "svelte";
import type { Size } from "./types";

type $Props = { size: Size };

export type TsRunesPerPropImportedTypeProps = $Props;

export default class TsRunesPerPropImportedType extends SvelteComponentTyped<
  TsRunesPerPropImportedTypeProps,
  Record<string, any>,
  Record<string, never>
> {}
