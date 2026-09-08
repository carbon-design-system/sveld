export function format(value: string): string;
export function format(value: number): string;
export function format(value: string | number): string {
  return String(value);
}
