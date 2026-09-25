import { List } from "./output-class";

const list = new List<string>(["a"]);
const length: number = list.push("b");
const lengths: List<number> = list.map((item) => item.length);
const items: string[] = list.items;
const limit = List.limit;

// @ts-expect-error `push` takes a `T`
list.push(1);

export { items, length, lengths, limit };
