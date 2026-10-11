# Component Index

> 5 components exported from multi-export-typed@0.0.1.

## Components

- [`Button`](#button)
- [`Link`](#link)
- [`Polymorphic`](#polymorphic)
- [`Quote`](#quote)
- [`SecondaryButton`](#secondarybutton)

---

## `Button`

### Props

| Prop name | Required | Kind | Reactive | Binding | Type | Default value | Description |
| :- | :- | :- | :- | :- | :- | :- | :- |
| type | No | <code>let</code> | No | -- | <code>"button" &#124; "submit" &#124; "reset"</code> | <code>"button"</code> | -- |
| primary | No | <code>let</code> | No | -- | <code>boolean</code> | <code>false</code> | Set to `true` to use the primary variant |

### Slots

| Slot name | Default | Props | Fallback | Description |
| :- | :- | :- | :- | :- |
| -- | Yes | <code>Record&lt;string, never> </code> | <code>Click me</code> | -- |

### Events

| Event name | Type | Detail | Description |
| :- | :- | :- | :- |
| click | forwarded | -- | -- |

## `Link`

### Props

None.

### Slots

| Slot name | Default | Props | Fallback | Description |
| :- | :- | :- | :- | :- |
| -- | Yes | <code>Record&lt;string, never> </code> | <code>Link text</code> | -- |

### Events

| Event name | Type | Detail | Description |
| :- | :- | :- | :- |
| click | forwarded | -- | -- |

## `Polymorphic`

**Type parameters:** <code>&lt;Tag extends keyof HTMLElementTagNameMap = "div"></code>

### Props

| Prop name | Required | Kind | Reactive | Binding | Type | Default value | Description |
| :- | :- | :- | :- | :- | :- | :- | :- |
| tag | No | <code>let</code> | No | -- | <code>Tag</code> | <code>"div"</code> | Specify the element to render. |

### Slots

| Slot name | Default | Props | Fallback | Description |
| :- | :- | :- | :- | :- |
| -- | Yes | <code>Record&lt;string, never> </code> | -- | -- |

### Events

None.

## `Quote`

### Props

| Prop name | Required | Kind | Reactive | Binding | Type | Default value | Description |
| :- | :- | :- | :- | :- | :- | :- | :- |
| quote | No | <code>let</code> | No | -- | <code>string</code> | <code>""</code> | -- |
| author | No | <code>let</code> | No | -- | <code>string</code> | <code>""</code> | -- |

### Slots

| Slot name | Default | Props | Fallback | Description |
| :- | :- | :- | :- | :- |
| -- | Yes | <code>Record&lt;string, never> </code> | <code>{quote}</code> | -- |

### Events

None.

## `SecondaryButton`

### Props

| Prop name | Required | Kind | Reactive | Binding | Type | Default value | Description |
| :- | :- | :- | :- | :- | :- | :- | :- |
| secondary | No | <code>accessor</code> | No | -- | <code>boolean</code> | <code>true</code> | -- |

### Slots

| Slot name | Default | Props | Fallback | Description |
| :- | :- | :- | :- | :- |
| -- | Yes | <code>Record&lt;string, never> </code> | <code>Click me</code> | -- |

### Events

| Event name | Type | Detail | Description |
| :- | :- | :- | :- |
| click | forwarded | -- | -- |

