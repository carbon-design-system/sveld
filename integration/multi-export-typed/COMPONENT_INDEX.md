# Component Index

> 3 components exported from multi-export-typed@0.0.1.

## Components

- [`Button`](#button)
- [`Link`](#link)
- [`Quote`](#quote)

---

## `Button`

### Props

| Prop name | Kind             | Reactive | Type                                                 | Default value         | Description                              |
| :-------- | :--------------- | :------- | :--------------------------------------------------- | --------------------- | ---------------------------------------- |
| type      | <code>let</code> | No       | <code>"button" &#124; "submit" &#124; "reset"</code> | <code>"button"</code> | --                                       |
| primary   | <code>let</code> | No       | <code>boolean</code>                                 | <code>false</code>    | Set to `true` to use the primary variant |

### Slots

| Slot name | Default | Props | Fallback              |
| :-------- | :------ | :---- | :-------------------- |
| --        | Yes     | --    | <code>Click me</code> |

### Events

| Event name | Type      | Detail |
| :--------- | :-------- | :----- |
| click      | forwarded | --     |

## `Link`

### Props

None.

### Slots

| Slot name | Default | Props | Fallback               |
| :-------- | :------ | :---- | :--------------------- |
| --        | Yes     | --    | <code>Link text</code> |

### Events

| Event name | Type      | Detail |
| :--------- | :-------- | :----- |
| click      | forwarded | --     |

## `Quote`

### Props

| Prop name | Kind             | Reactive | Type                | Default value   | Description |
| :-------- | :--------------- | :------- | :------------------ | --------------- | ----------- |
| quote     | <code>let</code> | No       | <code>string</code> | <code>""</code> | --          |
| author    | <code>let</code> | No       | <code>string</code> | <code>""</code> | --          |

### Slots

| Slot name | Default | Props | Fallback             |
| :-------- | :------ | :---- | :------------------- |
| --        | Yes     | --    | <code>{quote}</code> |

### Events

None.
