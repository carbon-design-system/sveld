// Did hydration adopt the prerendered DOM? Snapshots every element when HTML
// parsing ends (before module scripts run), then again at the `hydrated` mark,
// and reports server elements that were thrown away, elements the client
// created, and kept elements whose attributes or text changed. Also prints
// the page's console warnings and errors.
// Usage: bun run perf:hydration -- [url] [--throttle none|desktop|mobile]
// Svelte names a mismatch (`hydration_mismatch`) only in dev builds; build one
// with `svelte({ compilerOptions: { dev: true } })` to see which.
import { openView, parseArgs, waitFor } from "./_shared";

const { url, throttle } = parseArgs(undefined, { throttle: "none" });
const LIST = 15;

const observe = `(() => {
  const h = (window.__hydration = {});
  const label = (el) => el.localName + (el.id ? "#" + el.id : el.classList[0] ? "." + el.classList[0] : "");
  // Up to two ancestors, stopping at one with an id.
  const path = (el) => {
    const parts = [label(el)];
    for (let p = el.parentElement; p && p !== document.body && parts.length < 3; p = p.parentElement) {
      parts.unshift(label(p));
      if (p.id) break;
    }
    return parts.join(" > ");
  };
  // Attributes, plus the element's own text as "#text".
  const state = (el) => {
    const s = Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));
    s["#text"] = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.data).join("");
    return s;
  };
  // Report only the root of each removed or added subtree, with its size.
  const roots = (els, set) =>
    els.filter((el) => !set.has(el.parentElement)).map((el) => ({
      path: path(el),
      size: els.filter((d) => el.contains(d)).length,
    }));

  document.addEventListener("readystatechange", () => {
    if (document.readyState !== "interactive") return;
    h.server = [...document.body.querySelectorAll("*")];
    h.before = new Map(h.server.map((el) => [el, state(el)]));
  });
  h.snapshot = (at) => {
    if (h.result || !h.server) return;
    const now = [...document.body.querySelectorAll("*")];
    const server = new Set(h.server);
    const removed = h.server.filter((el) => !el.isConnected);
    const added = now.filter((el) => !server.has(el));
    const changed = [];
    for (const el of h.server) {
      if (!el.isConnected) continue;
      const was = h.before.get(el), is = state(el);
      for (const name of new Set([...Object.keys(was), ...Object.keys(is)])) {
        if (was[name] !== is[name]) changed.push({ path: path(el), name, was: was[name] ?? null, is: is[name] ?? null });
      }
    }
    h.result = {
      at,
      time: performance.now(),
      server: h.server.length,
      removed: roots(removed, new Set(removed)),
      removedCount: removed.length,
      added: roots(added, new Set(added)),
      addedCount: added.length,
      changed,
    };
  };
  // Snapshot synchronously when the page marks hydration done.
  const mark = performance.mark.bind(performance);
  performance.mark = (name, options) => {
    const entry = mark(name, options);
    if (name === "hydrated") h.snapshot("hydrated mark");
    return entry;
  };
})()`;

const logs: string[] = [];
const describe = (arg: unknown) =>
  typeof arg === "object" && arg !== null && "description" in arg ? String(arg.description) : String(arg);
await using view = await openView(throttle, {
  initScript: observe,
  console: (type, ...args) => {
    if (type === "warn" || type === "error") logs.push(`${type}: ${args.map(describe).join(" ")}`);
  },
});
await view.navigate(url);
try {
  await waitFor(view, "window.__hydration?.result", 15_000);
} catch {
  // No `hydrated` mark: fall back to the state after load.
  await waitFor(view, `document.readyState === "complete"`);
  await view.evaluate(`window.__hydration.snapshot("load (no hydrated mark)")`);
}

type Root = { path: string; size: number };
type Change = { path: string; name: string; was: string | null; is: string | null };
type Result = {
  at: string;
  time: number;
  server: number;
  removed: Root[];
  removedCount: number;
  added: Root[];
  addedCount: number;
  changed: Change[];
};
const result = await view.evaluate<Result>("window.__hydration.result");
if (!result) throw new Error("no server-rendered elements seen; is the page prerendered?");

const clip = (s: string | null) =>
  s === null ? "(none)" : s.length > 60 ? `${JSON.stringify(s.slice(0, 57))}...` : JSON.stringify(s);
const list = <T>(items: T[], line: (item: T) => string) => {
  for (const item of items.slice(0, LIST)) console.log(`    ${line(item)}`);
  if (items.length > LIST) console.log(`    ... ${items.length - LIST} more`);
};

console.log(`${url} — at ${result.at}, ${Math.round(result.time)} ms\n`);
const kept = result.server - result.removedCount;
console.log(`  server elements  ${result.server}, ${kept} adopted (${Math.round((kept / result.server) * 100)}%)`);
console.log(`  removed          ${result.removedCount}`);
list(result.removed, (r) => `${r.path}${r.size > 1 ? `  (${r.size} elements)` : ""}`);
console.log(`  added            ${result.addedCount}`);
list(result.added, (r) => `${r.path}${r.size > 1 ? `  (${r.size} elements)` : ""}`);
console.log(`  changed          ${result.changed.length} attributes or texts`);
list(result.changed, (c) => `${c.path}  ${c.name}: ${clip(c.was)} → ${clip(c.is)}`);
console.log(`  console          ${logs.length} warnings/errors`);
list(logs, (log) => (log.length > 120 ? `${log.slice(0, 117)}...` : log));
