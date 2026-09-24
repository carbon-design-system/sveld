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
