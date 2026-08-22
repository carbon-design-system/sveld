/**
 * HTML5 tag-omission rules. `<li>` closes on the next `<li>`, `<p>` closes on
 * a following block-level element, and so on. From svelte's
 * `src/html-tree-validation.js`. Same table so lists and tables without every
 * closing tag written out still match svelte's tree.
 */

interface AutocloseRule {
  direct?: string[];
  descendant?: string[];
}

const AUTOCLOSING_CHILDREN: Record<string, AutocloseRule> = {
  li: { direct: ["li"] },
  dt: { descendant: ["dt", "dd"] },
  dd: { descendant: ["dt", "dd"] },
  p: {
    descendant: [
      "address",
      "article",
      "aside",
      "blockquote",
      "div",
      "dl",
      "fieldset",
      "footer",
      "form",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "header",
      "hgroup",
      "hr",
      "main",
      "menu",
      "nav",
      "ol",
      "p",
      "pre",
      "section",
      "table",
      "ul",
    ],
  },
  rt: { descendant: ["rt", "rp"] },
  rp: { descendant: ["rt", "rp"] },
  optgroup: { descendant: ["optgroup"] },
  option: { descendant: ["option", "optgroup"] },
  thead: { direct: ["tbody", "tfoot"] },
  tbody: { direct: ["tbody", "tfoot"] },
  tfoot: { direct: ["tbody"] },
  tr: { direct: ["tr", "tbody"] },
  td: { direct: ["td", "th", "tr"] },
  th: { direct: ["td", "th", "tr"] },
};

/**
 * True if `current` is auto-closed by a following `next` tag, or by running
 * out of siblings when `next` is undefined.
 */
export function closingTagOmitted(current: string, next?: string): boolean {
  const disallowed = AUTOCLOSING_CHILDREN[current];
  if (!disallowed) return false;

  if (!next) return true;

  const list = disallowed.direct ?? disallowed.descendant ?? [];
  return list.includes(next);
}
