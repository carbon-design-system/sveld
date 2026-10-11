import { SvelteComponentTyped } from "svelte";

interface DataTableRow {
  id: string | number;
  [key: string]: any;
}

type $Props<Handler extends (value: string) => void = () => {}, Row extends DataTableRow = DataTableRow> = {
  onSelect: Handler;
  rows: ReadonlyArray<Row>;
} & {
  children?: (this: void, ...args: [{
        onSelect: Handler;
        rows: ReadonlyArray<Row>;
      }]) => void;
};

export type GenericsAttributeArrowTypeProps<Handler extends (value: string) => void = () => {}, Row extends DataTableRow = DataTableRow> = $Props<Handler, Row>;

export default class GenericsAttributeArrowType<Handler extends (value: string) => void = () => {}, Row extends DataTableRow = DataTableRow> extends SvelteComponentTyped<
  GenericsAttributeArrowTypeProps<Handler, Row>,
  Record<string, any>,
  {
    default: {
      onSelect: Handler;
      rows: ReadonlyArray<Row>;
    };
  }
> {}
