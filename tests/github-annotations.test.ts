import type { ApiChange, CheckResult } from "../src/check";
import { formatCheckGitHub, formatCheckGitHubSummary } from "../src/github-annotations";

const BUTTON_ERROR_ANNOTATION_REGEX = /^::error file=Button,title=sveld breaking change::/;

function checkResult(changes: ApiChange[]): CheckResult {
  return { snapshotExists: true, snapshotFile: "COMPONENT_API.json", changes, bump: "none" };
}

const MINOR_CHANGE: ApiChange = {
  component: "Button",
  kind: "prop",
  name: "icon",
  bump: "minor",
  message: 'prop "icon" added',
};

const SCHEMA_CHANGE: ApiChange = {
  component: "*",
  kind: "schema",
  bump: "none",
  message: "snapshot schemaVersion 1 differs from 2; regenerate the snapshot",
};

describe("formatCheckGitHub", () => {
  test("a minor change produces no ::error at the default major level", () => {
    expect(formatCheckGitHub(checkResult([MINOR_CHANGE]), "major")).toBe("");
  });

  test("a minor change produces an ::error at the minor level", () => {
    expect(formatCheckGitHub(checkResult([MINOR_CHANGE]), "minor")).toMatch(BUTTON_ERROR_ANNOTATION_REGEX);
  });

  test("a schema change never produces an ::error, even at the patch level", () => {
    expect(formatCheckGitHub(checkResult([SCHEMA_CHANGE]), "patch")).toBe("");
  });
});

describe("formatCheckGitHubSummary", () => {
  test("a minor change produces no summary row at the default major level", () => {
    expect(formatCheckGitHubSummary(checkResult([MINOR_CHANGE]), "major")).toBe("");
  });

  test("a minor change produces a summary row at the minor level", () => {
    const summary = formatCheckGitHubSummary(checkResult([MINOR_CHANGE]), "minor");
    expect(summary).toContain("### sveld breaking changes");
    expect(summary).toContain('prop "icon" added');
  });

  test("a schema change never produces a summary row, even at the patch level", () => {
    expect(formatCheckGitHubSummary(checkResult([SCHEMA_CHANGE]), "patch")).toBe("");
  });
});
