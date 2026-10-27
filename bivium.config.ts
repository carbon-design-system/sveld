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
  ignore: ["**/*.md", "docs/**", "playground/**", "LICENSE"],
  // sveld reads and imports its user's files: the paths a test passes it, or
  // temp directories a test writes. A file here that reads one of this
  // repository's files still names it with `// @reads <glob>`.
  hermetic: ["src/**", "scripts/build-id.ts", "scripts/bundle-dts.ts", "tests/*.test.ts"],
});
