import { defineConfig } from "bivium";

export default defineConfig({
  suites: {
    unit: {
      tests: "tests/*.test.ts",
      run: "bun test --parallel {files}",
      root: "tests",
      // Read by `bun check` or the e2e suite, never by `bun test`.
      nonInputs: ["tests/e2e/**", "tests/test-e2e.ts", "tests/svelte-shim.d.ts"],
    },
    // CI runs both or neither: the inferred-types check uses the
    // svelte-check the e2e run installs.
    e2e: {
      tests: ["tests/test-e2e.ts", "scripts/check-inferred-types.ts"],
      root: "tests/e2e",
    },
  },
  roots: ["src", "tests", "scripts", "schema", "package.json", "tsconfig.json", "tsconfig.fixtures.json"],
  // Lint config: no suite runs Biome or knip.
  ignore: ["**/*.md", "docs/**", "playground/**", "LICENSE", "biome.json", "knip.json"],
  // Tests that read fixtures from disk. They're hermetic, which vouches only
  // for the temp files they write, so without these a fixture edit trips the
  // orphan rule and runs every unit test.
  reads: {
    "tests/fixtures.test.ts": "tests/fixtures/**",
    "tests/component-api-schema.test.ts": ["tests/fixtures/**", "tests/fixtures-entry-exports/**"],
    "tests/example-check.test.ts": "tests/fixtures/example-check/**",
    "tests/resolve-types.test.ts": "tests/fixtures/runes-whole-props-imported/**",
    "tests/typecheck-option-matrix.test.ts": ["tests/fixtures/typedef-description/**", "tsconfig.fixtures.json"],
    "tests/parse-entry-exports.test.ts": "tests/fixtures-entry-exports/**",
    "tests/plugin.test.ts": "tests/fixtures-entry-exports/entry.js",
  },
  // Tools CI runs on its own: a bump that only reaches them selects nothing.
  inert: ["@biomejs/biome", "knip", "ostia", "@types/*"],
  // sveld reads and imports its user's files: the paths a test passes it, or
  // temp directories a test writes. A file here that reads one of this
  // repository's files still names it with `// @reads <glob>`.
  hermetic: ["src/**", "scripts/build-id.ts", "scripts/bundle-dts.ts", "tests/*.test.ts"],
});
