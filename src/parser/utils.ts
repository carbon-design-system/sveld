export function assignValueOrUndefined(value?: "" | string) {
  return value === undefined || value === "" ? undefined : value;
}
