import type { SerializedComponentEvent } from "../ComponentParser";
import { compareText } from "./utils";

/** Event order in every output: by name, then dispatched before forwarded, then by element and detail. */
export function compareSerializedEvents(a: SerializedComponentEvent, b: SerializedComponentEvent): number {
  const nameCompare = compareText(a.name, b.name);
  if (nameCompare !== 0) return nameCompare;

  const typeCompare = compareText(a.type, b.type);
  if (typeCompare !== 0) return typeCompare;

  if (a.type === "forwarded" && b.type === "forwarded") {
    const elementCompare = compareText(a.element, b.element);
    if (elementCompare !== 0) return elementCompare;
  }

  return compareText(a.detail ?? "", b.detail ?? "");
}
