import { type Counter, "counter-class" as CounterClass, Tally } from "./output-class";

const counter: Counter = new Tally(1).increment();
const count: number = counter.count;
const quoted: Counter = new CounterClass(2);

export { count, quoted };
