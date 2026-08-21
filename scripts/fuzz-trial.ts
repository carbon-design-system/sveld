/**
 * One fuzz trial. Reads `.svelte` from stdin, parses and writes it, prints
 * one JSON line to stdout.
 *
 * Spawned by `fuzz-parser.ts` with a kill timeout so a hang only takes down
 * this child. Also runs `svelte/compiler`'s `parse()`, not `compile()`, so
 * the parent can tell "both parsers reject this junk" from "sveld rejects
 * something svelte accepts".
 */
import { parse as svelteParse } from "svelte/compiler";
import ComponentParser from "../src/ComponentParser";
import { writeTsDefinition } from "../src/writer/writer-ts-definitions";

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const source = await readStdin();

let svelteAccepts = true;
try {
  svelteParse(source, { modern: true });
} catch {
  svelteAccepts = false;
}

const t0 = performance.now();
try {
  const parser = new ComponentParser();
  const parsed = parser.parseSvelteComponent(source, {
    filePath: "fuzz-target.svelte",
    moduleName: "FuzzTarget",
  } as never);
  writeTsDefinition({
    ...parsed,
    moduleName: "FuzzTarget",
    filePath: "fuzz-target.svelte",
  } as never);
  console.log(JSON.stringify({ ok: true, ms: performance.now() - t0, svelteAccepts }));
} catch (error) {
  const err = error as { name?: string; constructor?: { name?: string }; message?: string };
  console.log(
    JSON.stringify({
      ok: false,
      ms: performance.now() - t0,
      svelteAccepts,
      errorName: err?.name ?? err?.constructor?.name ?? "Unknown",
      errorMessage: err?.message ?? String(error),
    }),
  );
}
