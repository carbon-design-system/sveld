# Troubleshooting

**A prop came out `any`.** Run with `--report-diagnostics` to see which props sveld couldn't infer, then add a `@type` tag or a TypeScript annotation. `--strict` fails CI on them. See [Diagnostics](ci.md#diagnostics).

**Consumers don't get the generated types.** Check that the types folder is in both `exports` and `files` in `package.json`. See [Publishing to npm](output.md#publishing-to-npm).

**`sveld: cannot resolve "..." from ...`.** An `export *` or named re-export points at a module or path alias that doesn't resolve to a file. Fix the specifier, or the `paths` entry it should match. This exits `1`.

**A path alias (`$lib`, `@components`, ...) isn't picked up.** sveld reads aliases only from `compilerOptions.paths` in the nearest `tsconfig.json` or `jsconfig.json`, walking up from the importing file. It doesn't read `vite.config.*` or `svelte.config.*`, so add the same aliases to `paths`. When a pattern has several targets, sveld uses the first that exists on disk (or the first, if none do). Among matching patterns, the longest prefix before the `*` wins, as in `tsc`.

**`require("sveld")` fails.** sveld is ESM-only. Use `import` or dynamic `import()`.

**`sveld.config.ts` fails to load.** It's loaded with a plain `import()`, so the runtime has to strip TypeScript: Bun, or Node 22.18+ / 23.6+. Use `sveld.config.js` or `.mjs` on older Node.

**`checkExamples` fails the run.** Checking TS/JS examples needs `typescript` 7+ and a `tsconfig.json`. Install them, or use `checkExamples: "syntax"` to check only `svelte`/`html` examples. See [Checking `@example` blocks](ci.md#checking-example-blocks).

**Does my Svelte version matter?** No. sveld parses `.svelte` files with its own template parser, kept in parity with `svelte/compiler` by a differential test suite and a weekly check against `svelte@latest`. Svelte 3, 4, and 5 components parse the same way regardless of the installed version.
