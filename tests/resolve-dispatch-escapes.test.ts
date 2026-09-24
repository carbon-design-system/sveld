import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type ComponentDocApi, type ComponentDocs, generateBundle } from "../src/bundle";

function byModuleName(components: ComponentDocs, moduleName: string): ComponentDocApi | undefined {
  return Array.from(components.values()).find((component) => component.moduleName === moduleName);
}

describe("events dispatched by an imported helper", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-dispatch-escapes-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** Writes `Menu.svelte` with `script` as its instance script, plus the barrel, and bundles it. */
  async function bundleMenu(script: string) {
    writeFileSync(path.join(dir, "Menu.svelte"), `<script>\n${script}\n</script>\n<div />\n`);
    writeFileSync(path.join(dir, "index.js"), `export { default as Menu } from "./Menu.svelte";\n`);
    return generateBundle(path.join(dir, "index.js"), true);
  }

  test("adds the events a helper dispatches through its parameter, in every output", async () => {
    writeFileSync(
      path.join(dir, "open-close.js"),
      `export function createOpenCloseDispatcher(dispatch) {
  let prev;
  return (open) => {
    if (prev !== undefined) dispatch(open ? "open" : "close");
    prev = open;
  };
}
`,
    );

    const result = await bundleMenu(`  import { createEventDispatcher } from "svelte";
  import { createOpenCloseDispatcher } from "./open-close.js";

  export let open = false;
  const dispatch = createEventDispatcher();
  const notify = createOpenCloseDispatcher(dispatch);
  $: notify(open);`);

    for (const components of [result.components, result.allComponentsForTypes]) {
      expect(byModuleName(components, "Menu")?.events).toMatchObject([
        { type: "dispatched", name: "close", detail: "null" },
        { type: "dispatched", name: "open", detail: "null" },
      ]);
    }
    expect(result.diagnostics).toEqual([]);
  });

  test("reads a dispatcher passed in an options object, destructured or not", async () => {
    writeFileSync(
      path.join(dir, "helpers.js"),
      `export const createCloseHandler = ({ getOpen, dispatch }) => (trigger) => {
  if (getOpen()) dispatch("close", { trigger });
};

export function createSelectHandler(options) {
  return () => options.dispatch("select", 1);
}
`,
    );

    const result = await bundleMenu(`  import { createEventDispatcher } from "svelte";
  import { createCloseHandler, createSelectHandler } from "./helpers.js";

  /**
   * @event close
   * @type {{ trigger: "escape-key" | "outside-click" }}
   */
  let open = false;
  const dispatch = createEventDispatcher();
  createCloseHandler({ getOpen: () => open, dispatch });
  createSelectHandler({ dispatch });`);

    expect(byModuleName(result.components, "Menu")?.events).toMatchObject([
      { name: "close", detail: '{ trigger: "escape-key" | "outside-click" }' },
      { name: "select", detail: "1" },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  test("follows re-exports to the helper", async () => {
    writeFileSync(path.join(dir, "notify.js"), `export function notify(dispatch) { dispatch("change"); }\n`);
    writeFileSync(path.join(dir, "utils.js"), `export { notify } from "./notify.js";\n`);

    const result = await bundleMenu(`  import { createEventDispatcher } from "svelte";
  import { notify } from "./utils.js";

  const dispatch = createEventDispatcher();
  notify(dispatch);`);

    expect(byModuleName(result.components, "Menu")?.events.map((event) => event.name)).toEqual(["change"]);
  });

  test("a helper dispatch beats forwarding an event of the same name, as a local dispatch does", async () => {
    writeFileSync(
      path.join(dir, "Menu.svelte"),
      `<script>
  /** @event focus - Focus moved */
  import { createEventDispatcher } from "svelte";
  import { clickWith } from "./helpers.js";

  const dispatch = createEventDispatcher();
  clickWith(dispatch);
</script>
<button on:click on:focus />
`,
    );
    writeFileSync(path.join(dir, "helpers.js"), `export function clickWith(d) { d("click", 1); d("focus"); }\n`);
    writeFileSync(path.join(dir, "index.js"), `export { default as Menu } from "./Menu.svelte";\n`);

    const result = await generateBundle(path.join(dir, "index.js"), true);

    for (const components of [result.components, result.allComponentsForTypes]) {
      expect(byModuleName(components, "Menu")?.events).toEqual([
        expect.objectContaining({ type: "dispatched", name: "click", detail: "1" }),
        expect.objectContaining({ type: "dispatched", name: "focus", detail: "null", description: "Focus moved" }),
      ]);
    }
  });

  test("follows default-imported and namespace-imported helpers", async () => {
    writeFileSync(path.join(dir, "declared.js"), `export default function track(dispatch) { dispatch("declared"); }\n`);
    writeFileSync(path.join(dir, "arrow.js"), `export default (dispatch) => dispatch("arrow");\n`);
    writeFileSync(path.join(dir, "named.js"), `function impl(dispatch) { dispatch("named"); }\nexport default impl;\n`);
    writeFileSync(
      path.join(dir, "aliased.js"),
      `function impl(dispatch) { dispatch("aliased"); }\nexport { impl as default };\n`,
    );
    writeFileSync(path.join(dir, "ns.js"), `export function open(dispatch) { dispatch("namespaced"); }\n`);

    const result = await bundleMenu(`  import { createEventDispatcher } from "svelte";
  import declared from "./declared.js";
  import arrow from "./arrow.js";
  import named from "./named.js";
  import aliased from "./aliased.js";
  import * as ns from "./ns.js";

  const dispatch = createEventDispatcher();
  declared(dispatch);
  arrow(dispatch);
  named(dispatch);
  aliased(dispatch);
  ns.open(dispatch);`);

    expect(byModuleName(result.components, "Menu")?.events.map((event) => event.name)).toEqual([
      "aliased",
      "arrow",
      "declared",
      "named",
      "namespaced",
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  test("doesn't follow a parameter that shadows an imported helper", async () => {
    writeFileSync(
      path.join(dir, "h.js"),
      `export function helper(d) { d("from-import"); }\nexport function open() {}\n`,
    );

    const result = await bundleMenu(`  import { createEventDispatcher } from "svelte";
  import { helper } from "./h.js";
  import * as h from "./h.js";

  const dispatch = createEventDispatcher();
  function wire(helper, h) {
    helper(dispatch);
    h.open(dispatch);
  }
  wire((d) => d("real"), { open: (d) => d("other") });`);

    // Neither `helper` nor `h.open` is the import, so both escapes stay unfollowed.
    expect(byModuleName(result.components, "Menu")?.events).toEqual([]);
    expect(result.diagnostics).toMatchObject([{ kind: "dispatch-escapes", name: "dispatch" }]);
  });

  test("names a default export that isn't a function in its diagnostic", async () => {
    writeFileSync(path.join(dir, "config.js"), "export default { retries: 3 };\n");

    const result = await bundleMenu(`  import { createEventDispatcher } from "svelte";
  import config from "./config.js";

  const dispatch = createEventDispatcher();
  config(dispatch);`);

    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      "`dispatch` is passed to `config`, but sveld couldn't read the events it dispatches: the default export isn't a function declared in \"./config.js\". Document them with @event tags.",
    ]);
  });

  test("still reports an @event that neither the component nor the helper dispatches", async () => {
    writeFileSync(path.join(dir, "notify.js"), `export function notify(dispatch) { dispatch("open"); }\n`);

    const result = await bundleMenu(`  /**
   * @event {null} open
   * @event {null} stale
   */
  import { createEventDispatcher } from "svelte";
  import { notify } from "./notify.js";

  const dispatch = createEventDispatcher();
  notify(dispatch);`);

    expect(result.diagnostics).toMatchObject([{ kind: "event-no-source", name: "stale" }]);
  });

  test.each([
    [
      "a dynamic event name",
      "export function notify(dispatch, name) { dispatch(name); }",
      "an event name isn't a string literal",
    ],
    [
      "a dispatcher passed on",
      'import { relay } from "./relay.js";\nexport function notify(dispatch) { relay(dispatch); }',
      '"notify" passes it on',
    ],
    ["a non-function export", "export const notify = 1;", '"notify" isn\'t a function declared in "./notify.js"'],
  ])("records dispatch-escapes for %s and keeps @event quiet", async (_label, helper, reason) => {
    writeFileSync(path.join(dir, "notify.js"), `${helper}\n`);

    const result = await bundleMenu(`  /** @event {null} open */
  import { createEventDispatcher } from "svelte";
  import { notify } from "./notify.js";

  const dispatch = createEventDispatcher();
  notify(dispatch, "open");`);

    expect(result.diagnostics).toMatchObject([
      {
        kind: "dispatch-escapes",
        code: "sveld/dispatch-escapes",
        name: "dispatch",
        message: `\`dispatch\` is passed to \`notify\`, but sveld couldn't read the events it dispatches: ${reason}. Document them with @event tags.`,
      },
    ]);
  });

  test("records dispatch-escapes for a package helper, ignorable on the dispatcher", async () => {
    const result = await bundleMenu(`  import { createEventDispatcher } from "svelte";
  import { track } from "some-analytics-package";

  /** @sveld-ignore sveld/dispatch-escapes */
  const dispatch = createEventDispatcher();
  track(dispatch);`);

    expect(result.diagnostics).toMatchObject([{ kind: "dispatch-escapes", name: "dispatch", ignored: true }]);
  });
});
