/**
 * Element tag map adapted from TypeScript's `lib.dom.d.ts`.
 *
 * Maps HTML element tag names to their corresponding TypeScript element types.
 * Used for generating proper TypeScript types for element bindings and rest props.
 *
 * @see {@link https://github.com/microsoft/TypeScript/blob/master/lib/lib.dom.d.ts#L19263 | TypeScript lib.dom.d.ts}
 *
 * @example
 * ```ts
 * tag_map["button"] // "HTMLButtonElement"
 * tag_map["div"]    // "HTMLDivElement"
 * tag_map["input"]  // "HTMLInputElement"
 * ```
 */
const tag_map = {
  a: "HTMLAnchorElement",
  applet: "HTMLAppletElement",
  area: "HTMLAreaElement",
  audio: "HTMLAudioElement",
  base: "HTMLBaseElement",
  basefont: "HTMLBaseFontElement",
  blockquote: "HTMLQuoteElement",
  body: "HTMLBodyElement",
  br: "HTMLBRElement",
  button: "HTMLButtonElement",
  canvas: "HTMLCanvasElement",
  caption: "HTMLTableCaptionElement",
  col: "HTMLTableColElement",
  colgroup: "HTMLTableColElement",
  data: "HTMLDataElement",
  datalist: "HTMLDataListElement",
  del: "HTMLModElement",
  details: "HTMLDetailsElement",
  dialog: "HTMLDialogElement",
  dir: "HTMLDirectoryElement",
  div: "HTMLDivElement",
  dl: "HTMLDListElement",
  embed: "HTMLEmbedElement",
  fieldset: "HTMLFieldSetElement",
  font: "HTMLFontElement",
  form: "HTMLFormElement",
  frame: "HTMLFrameElement",
  frameset: "HTMLFrameSetElement",
  h1: "HTMLHeadingElement",
  h2: "HTMLHeadingElement",
  h3: "HTMLHeadingElement",
  h4: "HTMLHeadingElement",
  h5: "HTMLHeadingElement",
  h6: "HTMLHeadingElement",
  head: "HTMLHeadElement",
  hr: "HTMLHRElement",
  html: "HTMLHtmlElement",
  iframe: "HTMLIFrameElement",
  img: "HTMLImageElement",
  input: "HTMLInputElement",
  ins: "HTMLModElement",
  label: "HTMLLabelElement",
  legend: "HTMLLegendElement",
  li: "HTMLLIElement",
  link: "HTMLLinkElement",
  map: "HTMLMapElement",
  marquee: "HTMLMarqueeElement",
  menu: "HTMLMenuElement",
  meta: "HTMLMetaElement",
  meter: "HTMLMeterElement",
  object: "HTMLObjectElement",
  ol: "HTMLOListElement",
  optgroup: "HTMLOptGroupElement",
  option: "HTMLOptionElement",
  output: "HTMLOutputElement",
  p: "HTMLParagraphElement",
  param: "HTMLParamElement",
  picture: "HTMLPictureElement",
  pre: "HTMLPreElement",
  progress: "HTMLProgressElement",
  q: "HTMLQuoteElement",
  script: "HTMLScriptElement",
  select: "HTMLSelectElement",
  slot: "HTMLSlotElement",
  source: "HTMLSourceElement",
  span: "HTMLSpanElement",
  style: "HTMLStyleElement",
  table: "HTMLTableElement",
  tbody: "HTMLTableSectionElement",
  td: "HTMLTableDataCellElement",
  template: "HTMLTemplateElement",
  textarea: "HTMLTextAreaElement",
  tfoot: "HTMLTableSectionElement",
  th: "HTMLTableHeaderCellElement",
  thead: "HTMLTableSectionElement",
  time: "HTMLTimeElement",
  title: "HTMLTitleElement",
  tr: "HTMLTableRowElement",
  track: "HTMLTrackElement",
  ul: "HTMLUListElement",
  video: "HTMLVideoElement",
};

type ElementTag = keyof typeof tag_map;

/**
 * Gets the TypeScript element type for a given HTML tag name.
 *
 * Returns the specific element type (e.g., `HTMLButtonElement`) if the tag
 * is in the map, otherwise returns the generic `HTMLElement` type.
 *
 * @param element - The HTML tag name (e.g., "button", "div", "input")
 * @returns The corresponding TypeScript element type name
 *
 * @example
 * ```ts
 * getElementByTag("button")  // Returns: "HTMLButtonElement"
 * getElementByTag("div")     // Returns: "HTMLDivElement"
 * getElementByTag("custom")  // Returns: "HTMLElement" (fallback)
 * ```
 */
export function getElementByTag(element: ElementTag | string) {
  return element in tag_map ? tag_map[element as ElementTag] : "HTMLElement";
}
