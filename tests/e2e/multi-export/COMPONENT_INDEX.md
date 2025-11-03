# Component Index

> 4 components exported from multi-export@0.0.1.

## Components

- [`Button`](#button)
- [`Header`](#header)
- [`Link`](#link)
- [`Quote`](#quote)

---

## `Button`

### Props

| Prop name | Required | Kind                  | Reactive | Type                   | Default value                          | Description |
| :-------- | :------- | :-------------------- | :------- | ---------------------- | -------------------------------------- | ----------- |
| type      | No       | <code>let</code>      | No       | <code>string</code>    | <code>"button"</code>                  | --          |
| primary   | No       | <code>let</code>      | No       | <code>boolean</code>   | <code>false</code>                     | --          |
| print     | No       | <code>function</code> | No       | <code>() => any</code> | <code>() => { console.log(0); }</code> | --          |

### Slots

| Slot name | Default | Props                               | Fallback              |
| :-------- | :------ | :---------------------------------- | :-------------------- |
| --        | Yes     | <code>Record<string, never> </code> | <code>Click me</code> |

### Events

| Event name | Type      | Detail |
| :--------- | :-------- | :----- |
| click      | forwarded | --     |

## `Header`

### Props

None.

### Slots

| Slot name | Default | Props                               | Fallback |
| :-------- | :------ | :---------------------------------- | :------- |
| --        | Yes     | <code>Record<string, never> </code> | --       |

### Events

None.

## `Link`

### Props

None.

### Slots

| Slot name | Default | Props                               | Fallback               |
| :-------- | :------ | :---------------------------------- | :--------------------- |
| --        | Yes     | <code>Record<string, never> </code> | <code>Link text</code> |

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

| Slot name | Default | Props                               | Fallback             |
| :-------- | :------ | :---------------------------------- | :------------------- |
| --        | Yes     | <code>Record<string, never> </code> | <code>{quote}</code> |

### Events

None.
