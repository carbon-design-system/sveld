import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["span"];

type $Props = {
  /**
   * Specify the file uploader status
   * @default "uploading"
   */
  status?: "uploading" | "edit" | "complete";

  /**
   * Specify the ARIA label used for the status icons
   * @default ""
   */
  iconDescription?: string;

  /**
   * Set to `true` to indicate an invalid state
   * @default false
   */
  invalid?: boolean;

  /**
   * Specify the error subject text
   * @default ""
   */
  errorSubject?: string;

  /**
   * Specify the error body text
   * @default ""
   */
  errorBody?: string;

  /**
   * Set an id for the top-level element
   * @default "ccs-" + Math.random().toString(36)
   */
  id?: string;

  /**
   * Specify the file uploader name
   * @default ""
   */
  name?: string;

  [key: `data-${string}`]: any;
};

export type FileUploaderItemProps = Omit<$RestProps, keyof $Props> & $Props;

export default class FileUploaderItem extends SvelteComponentTyped<
  FileUploaderItemProps,
  {
    delete: CustomEvent<string>;
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
