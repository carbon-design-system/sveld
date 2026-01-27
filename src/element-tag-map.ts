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
  abbr: "HTMLElement",
  address: "HTMLElement",
  applet: "HTMLUnknownElement",
  area: "HTMLAreaElement",
  article: "HTMLElement",
  aside: "HTMLElement",
  audio: "HTMLAudioElement",
  b: "HTMLElement",
  base: "HTMLBaseElement",
  basefont: "HTMLElement",
  bdi: "HTMLElement",
  bdo: "HTMLElement",
  blockquote: "HTMLQuoteElement",
  body: "HTMLBodyElement",
  br: "HTMLBRElement",
  button: "HTMLButtonElement",
  canvas: "HTMLCanvasElement",
  caption: "HTMLTableCaptionElement",
  cite: "HTMLElement",
  code: "HTMLElement",
  col: "HTMLTableColElement",
  colgroup: "HTMLTableColElement",
  data: "HTMLDataElement",
  datalist: "HTMLDataListElement",
  dd: "HTMLElement",
  del: "HTMLModElement",
  details: "HTMLDetailsElement",
  dfn: "HTMLElement",
  dialog: "HTMLDialogElement",
  dir: "HTMLDirectoryElement",
  div: "HTMLDivElement",
  dl: "HTMLDListElement",
  dt: "HTMLElement",
  em: "HTMLElement",
  embed: "HTMLEmbedElement",
  fieldset: "HTMLFieldSetElement",
  figcaption: "HTMLElement",
  figure: "HTMLElement",
  font: "HTMLFontElement",
  footer: "HTMLElement",
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
  header: "HTMLElement",
  hgroup: "HTMLElement",
  hr: "HTMLHRElement",
  html: "HTMLHtmlElement",
  i: "HTMLElement",
  iframe: "HTMLIFrameElement",
  img: "HTMLImageElement",
  input: "HTMLInputElement",
  ins: "HTMLModElement",
  kbd: "HTMLElement",
  label: "HTMLLabelElement",
  legend: "HTMLLegendElement",
  li: "HTMLLIElement",
  link: "HTMLLinkElement",
  main: "HTMLElement",
  map: "HTMLMapElement",
  mark: "HTMLElement",
  marquee: "HTMLMarqueeElement",
  menu: "HTMLMenuElement",
  meta: "HTMLMetaElement",
  meter: "HTMLMeterElement",
  nav: "HTMLElement",
  noscript: "HTMLElement",
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
  rp: "HTMLElement",
  rt: "HTMLElement",
  ruby: "HTMLElement",
  s: "HTMLElement",
  samp: "HTMLElement",
  script: "HTMLScriptElement",
  search: "HTMLElement",
  section: "HTMLElement",
  select: "HTMLSelectElement",
  slot: "HTMLSlotElement",
  small: "HTMLElement",
  source: "HTMLSourceElement",
  span: "HTMLSpanElement",
  strong: "HTMLElement",
  style: "HTMLStyleElement",
  sub: "HTMLElement",
  summary: "HTMLElement",
  sup: "HTMLElement",
  table: "HTMLTableElement",
  tbody: "HTMLTableSectionElement",
  td: "HTMLTableCellElement",
  template: "HTMLTemplateElement",
  textarea: "HTMLTextAreaElement",
  tfoot: "HTMLTableSectionElement",
  th: "HTMLTableCellElement",
  thead: "HTMLTableSectionElement",
  time: "HTMLTimeElement",
  title: "HTMLTitleElement",
  tr: "HTMLTableRowElement",
  track: "HTMLTrackElement",
  u: "HTMLElement",
  ul: "HTMLUListElement",
  var: "HTMLElement",
  video: "HTMLVideoElement",
  wbr: "HTMLElement",
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
