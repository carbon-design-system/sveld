# Component Index

## Components

- [`RunesButton`](#runesbutton)

---

## `RunesButton`

### Props

| Prop name | Required | Kind             | Reactive | Type                | Default value        | Description |
| :-------- | :------- | :--------------- | :------- | ------------------- | -------------------- | ----------- |
| value     | No       | <code>let</code> | Yes      | <code>string</code> | <code>"ready"</code> | --          |
| label     | Yes      | <code>let</code> | No       | --                  | --                   | --          |
| onclick   | Yes      | <code>let</code> | No       | --                  | --                   | --          |
| children  | Yes      | <code>let</code> | No       | --                  | --                   | --          |

### Slots

| Slot name | Default | Props                           | Fallback |
| :-------- | :------ | :------------------------------ | :------- |
| --        | Yes     | <code>{ value: string } </code> | --       |

### Events

| Event name | Type       | Detail | Description |
| :--------- | :--------- | :----- | :---------- |
| press      | dispatched | --     | --          |
