# Component Index

## Components

- [`Button`](#button)

---

## `Button`

### Props

| Prop name | Required | Kind             | Reactive | Type                 | Default value         | Description                              |
| :-------- | :------- | :--------------- | :------- | -------------------- | --------------------- | ---------------------------------------- |
| type      | No       | <code>let</code> | No       | <code>string</code>  | <code>"button"</code> | Button type attribute                    |
| primary   | No       | <code>let</code> | No       | <code>boolean</code> | <code>false</code>    | Set to `true` to use the primary variant |

### Slots

| Slot name | Default | Props                               | Fallback              |
| :-------- | :------ | :---------------------------------- | :-------------------- |
| --        | Yes     | <code>Record<string, never> </code> | <code>Click me</code> |

### Events

| Event name | Type      | Detail | Description |
| :--------- | :-------- | :----- | :---------- |
| click      | forwarded | --     | --          |
