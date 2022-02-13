import { a, b, e, log } from "./output";

const a: log = () => {};

// @ts-expect-error
a(4);

a(4 + "");

// @ts-expect-error
const e_value: e = {};
