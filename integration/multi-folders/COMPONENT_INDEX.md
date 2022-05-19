# Component Index

> 5 components exported from multi-folders@0.0.1.

## Components

- [`Button`](#button)
- [`Card`](#card)
- [`Header`](#header)
- [`Link`](#link)
- [`Quote`](#quote)

---

## `Button`

### Props

| Prop name | Required | Kind             | Reactive | Type                                                 | Default value         | Description                              |
| :-------- | :------- | :--------------- | :------- | ---------------------------------------------------- | --------------------- | ---------------------------------------- |
| type      | No       | <code>let</code> | No       | <code>"button" &#124; "submit" &#124; "reset"</code> | <code>"button"</code> | --                                       |
| primary   | No       | <code>let</code> | No       | <code>boolean</code>                                 | <code>false</code>    | Set to `true` to use the primary variant |

### Slots

| Slot name | Default | Props | Fallback              |
| :-------- | :------ | :---- | :-------------------- |
| --        | Yes     | --    | <code>Click me</code> |

### Events

| Event name | Type      | Detail |
| :--------- | :-------- | :----- |
| click      | forwarded | --     |

## `Card`

### Props

None.

### Slots

| Slot name | Default | Props | Fallback |
| :-------- | :------ | :---- | :------- |
| --        | Yes     | --    | --       |

### Events

None.

## `Header`

### Props

None.

### Slots

| Slot name | Default | Props | Fallback |
| :-------- | :------ | :---- | :------- |
| --        | Yes     | --    | --       |

### Events

None.

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
export type Author = string;
```

### Props

| Prop name | Required | Kind             | Reactive | Type                | Default value   | Description |
| :-------- | :------- | :--------------- | :------- | ------------------- | --------------- | ----------- |
| quote     | No       | <code>let</code> | No       | <code>any</code>    | <code>""</code> | --          |
| author    | No       | <code>let</code> | No       | <code>Author</code> | <code>""</code> | --          |

### Slots

| Slot name | Default | Props | Fallback             |
| :-------- | :------ | :---- | :------------------- |
| --        | Yes     | --    | <code>{quote}</code> |

### Events

None.
