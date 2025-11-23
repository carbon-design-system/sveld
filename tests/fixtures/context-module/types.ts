import { a, e, log, b2, b3 } from "./output";

log("");

b2()();

const function_b3: typeof b3 = () => () => false;

const result = b3()();

a.b;

const a_fn: typeof log = () => {};

// @ts-expect-error
a_fn(4);

a_fn(4 + "");

const e_value: typeof e = {};
