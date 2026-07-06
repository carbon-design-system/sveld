# Component Index

## Components

- [`RunesButton`](#runesbutton)
- [`RunesGenericList`](#runesgenericlist)

---

## `RunesButton`

### Props

| Prop name | Required | Kind             | Reactive | Binding | Type                | Default value        | Description |
| :-------- | :------- | :--------------- | :------- | :------ | :------------------ | :------------------- | :---------- |
| value     | No       | <code>let</code> | Yes      | --      | <code>string</code> | <code>"ready"</code> | --          |
| label     | Yes      | <code>let</code> | No       | --      | --                  | --                   | --          |
| onclick   | Yes      | <code>let</code> | No       | --      | --                  | --                   | --          |
| onpress   | Yes      | <code>let</code> | No       | --      | --                  | --                   | --          |

### Slots

| Slot name | Default | Props                           | Fallback | Description |
| :-------- | :------ | :------------------------------ | :------- | :---------- |
| --        | Yes     | <code>{ value: string } </code> | --       | --          |

### Events

None.

## `RunesGenericList`

### Props

| Prop name | Required | Kind             | Reactive | Binding | Type                               | Default value | Description |
| :-------- | :------- | :--------------- | :------- | :------ | :--------------------------------- | :------------ | :---------- |
| items     | Yes      | <code>let</code> | No       | --      | <code>Item[]</code>                | --            | --          |
| row       | Yes      | <code>let</code> | No       | --      | <code>Snippet<[item: Item]></code> | --            | --          |

### Slots

None.

### Events

None.
