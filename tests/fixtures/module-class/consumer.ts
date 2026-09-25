import { Base, Store } from "./output-class";
import { Store as ComponentFormatStore } from "./output-component";

const store = new Store({ id: "a" });
const id: string = store.value.id;
const name: string = store.name;
const created: Store<{ n: number }> = Store.create({ n: 1 });
const count: number = Store.count;
const unsubscribe: () => void = store.subscribe((value) => value.id);
const formatted: string = store.format(1);
const loaded: Promise<any> = store.load("a", "b");
const size: number = store.size;
store.mode = "b";

// @ts-expect-error `count` is readonly
Store.count = 1;
// @ts-expect-error `size` has no setter
store.size = 2;
// @ts-expect-error private members are left out
store.hidden;
// @ts-expect-error `@internal` members are left out
store.reset();

class Impl extends Base {
  readonly id = "x";
  run() {}
}

new ComponentFormatStore({}).snapshot().at satisfies number;

export { count, created, formatted, Impl, id, loaded, name, size, unsubscribe };
