import { a, e, log } from "./output";

const a: log = () => {};

// @ts-expect-error
a(4);

a(4 + "");

const e_value: e = {};
