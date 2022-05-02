import { a, e, log, b2, b3 } from "./output";

log("");

b2()();

const function_b3: typeof b3 = () => () => false;

const result = b3()();

const a: typeof log = () => {};

// @ts-expect-error
a(4);

a(4 + "");

const e_value: e = {};
