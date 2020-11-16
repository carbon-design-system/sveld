# Component Index

> 3 components exported from multi-export@0.0.1.

## Components

- [`Button`](#button)
- [`Link`](#link)
- [`Quote`](#quote)

---

## `Button`

### Props

| Prop name | Kind             | Reactive | Type                 | Default value         | Description |
| :-------- | :--------------- | :------- | :------------------- | --------------------- | ----------- |
| type      | <code>let</code> | No       | <code>string</code>  | <code>"button"</code> | --          |
| primary   | <code>let</code> | No       | <code>boolean</code> | <code>false</code>    | --          |

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

### Types

```ts
type Author = string;
```

### Props

| Prop name | Kind             | Reactive | Type                | Default value   | Description |
| :-------- | :--------------- | :------- | :------------------ | --------------- | ----------- |
| quote     | <code>let</code> | No       | <code>any</code>    | <code>""</code> | --          |
| author    | <code>let</code> | No       | <code>Author</code> | <code>""</code> | --          |

### Slots

| Slot name | Default | Props | Fallback             |
| :-------- | :------ | :---- | :------------------- |
| --        | Yes     | --    | <code>{quote}</code> |

### Events

None.
