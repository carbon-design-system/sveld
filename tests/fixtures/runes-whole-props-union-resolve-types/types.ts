export interface ClickEvent {
  kind: "click";
  target: string;
}

export interface HoverEvent {
  kind: "hover";
  duration: number;
}

export type Props = ClickEvent | HoverEvent;
