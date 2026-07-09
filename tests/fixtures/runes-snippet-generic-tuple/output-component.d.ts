import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
import type { Snippet } from "svelte";

type $Props<Row> = {
  rows: Row[];
  children: Snippet<[row: Row, index: number]>;
};

export type RunesSnippetGenericTupleProps<Row> = $Props<Row>;

export type RunesSnippetGenericTupleExports = Record<string, never>;

interface RunesSnippetGenericTupleComponent {
  new <Row>(
    options: ComponentConstructorOptions<RunesSnippetGenericTupleProps<Row>>
  ): SvelteComponent<RunesSnippetGenericTupleProps<Row>> & RunesSnippetGenericTupleExports;
  <Row>(
    this: void,
    internals: ComponentInternals,
    props: RunesSnippetGenericTupleProps<Row>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RunesSnippetGenericTupleProps<Row>>): void;
  } & RunesSnippetGenericTupleExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesSnippetGenericTuple: RunesSnippetGenericTupleComponent;
export default RunesSnippetGenericTuple;
