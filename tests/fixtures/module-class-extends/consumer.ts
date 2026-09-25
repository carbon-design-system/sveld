import type { Disposable, Named } from "./base";
import { NamedStore, Store } from "./output-class";
import { Store as ComponentFormatStore } from "./output-component";

const store = new Store<number>(1);
const value: number = store.value;
const disposable: Disposable = store;
store.dispose();

const named = new NamedStore("a");
const label: string = named.value;
const asNamed: Named = named;

new ComponentFormatStore<string>("x").value satisfies string;

export { asNamed, disposable, label, value };
