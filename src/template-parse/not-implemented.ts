/**
 * Thrown when this parser doesn't handle a construct yet. The shim test treats
 * this as "not covered", not a mismatch.
 */
export class TemplateParseNotImplementedError extends Error {
  constructor(construct: string) {
    super(`sveld's template parser doesn't support ${construct} yet.`);
    this.name = "TemplateParseNotImplementedError";
  }
}
