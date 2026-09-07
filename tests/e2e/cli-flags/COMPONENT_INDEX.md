# Component Index

## Components

- [`Badge`](#badge)
- [`Button`](#button)

---

## `Badge`

### Props

| Prop name | Required | Kind | Reactive | Binding | Type | Default value | Description |
| :- | :- | :- | :- | :- | :- | :- | :- |
| <s>color</s><br />**Deprecated**: Use `Tag` instead. | No | <code>let</code> | No | -- | <code>string</code> | <code>"gray"</code> | -- |

### Slots

| Slot name | Default | Props | Fallback | Description |
| :- | :- | :- | :- | :- |
| -- | Yes | <code>Record<string, never> </code> | -- | -- |

### Events

None.

## `Button`

### Props

| Prop name | Required | Kind | Reactive | Binding | Type | Default value | Description |
| :- | :- | :- | :- | :- | :- | :- | :- |
| label | No | <code>let</code> | No | -- | <code>string</code> | <code>"Click"</code> | -- |
| value | Yes | <code>let</code> | No | -- | -- | -- | -- |
| variant | No | <code>let</code> | No | -- | <code>string</code> | <code>"solid"</code> | -- |

### Slots

None.

### Events

| Event name | Type | Detail | Description |
| :- | :- | :- | :- |
| click | forwarded | -- | -- |

