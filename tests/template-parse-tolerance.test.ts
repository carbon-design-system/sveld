import ComponentParser from "../src/ComponentParser";
import { parse } from "../src/svelte-template-parse";

/**
 * Forward-compatibility: an unknown `<svelte:x>` meta tag (svelte adds
 * them over time, `<svelte:boundary>` arrived in 5.3) must parse as a
 * generic element-like node instead of failing the whole component. The
 * user's own svelte compile still validates the tag for real.
 */

interface ElementLikeNode {
  type: string;
  name: string;
  attributes: unknown[];
  fragment: { nodes: Array<{ type: string }> };
}

function firstNode(source: string): ElementLikeNode {
  const root = parse(source) as { fragment: { nodes: ElementLikeNode[] } };
  return root.fragment.nodes[0];
}

test("unknown svelte: meta tag parses with a derived type", () => {
  const node = firstNode('<svelte:portal target="#x" active={flag}><div>{content}</div></svelte:portal>');
  expect(node.type).toBe("SveltePortal");
  expect(node.name).toBe("svelte:portal");
  expect(node.attributes).toHaveLength(2);
  expect(node.fragment.nodes[0].type).toBe("RegularElement");
});

test("unknown svelte: meta tag can self-close and nest", () => {
  const div = firstNode("<div><svelte:portal /></div>");
  expect(div.fragment.nodes[0].type).toBe("SveltePortal");
});

test("hyphenated unknown meta tag derives a camel-cased type", () => {
  expect(firstNode("<svelte:foo-bar />").type).toBe("SvelteFooBar");
});

test("known meta tags keep their constraints", () => {
  // Root-only enforcement still applies to the known allowlist.
  expect(() => parse("<div><svelte:head></svelte:head></div>")).toThrow();
  // `<svelte:component>` still requires a `this` attribute.
  expect(() => parse("<svelte:component />")).toThrow();
});

test("ComponentParser still extracts the API around an unknown meta tag", () => {
  const parsed = new ComponentParser().parseSvelteComponent(
    "<script>export let x;</script>\n<svelte:portal><slot /></svelte:portal>",
    { moduleName: "Portal", filePath: "portal.svelte" },
  );
  expect(parsed.props.some((prop) => prop.name === "x")).toBe(true);
  expect(parsed.slots).toHaveLength(1);
});
