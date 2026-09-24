const COMMENT_CLOSE_REGEX = /\*\//g;

/**
 * Makes text safe to place inside a generated `/** ... *\/` comment: a `*\/`
 * in a glob default (`"src/**\/*.js"`) or description would otherwise end
 * the comment early and break the `.d.ts`.
 */
export function escapeCommentText(text: string): string {
  return text.replace(COMMENT_CLOSE_REGEX, "*\\/");
}

export function assignValueOrUndefined(value?: "" | string) {
  return value === undefined || value === "" ? undefined : value;
}
