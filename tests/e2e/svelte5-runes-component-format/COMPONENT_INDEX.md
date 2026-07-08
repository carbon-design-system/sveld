# Component Index

## Components

- [`LegacyPanel`](#legacypanel)
- [`RunesButton`](#runesbutton)
- [`RunesGenericList`](#runesgenericlist)

---

## `LegacyPanel`

### Props

| Prop name | Required | Kind | Reactive | Binding | Type | Default value | Description |
| :- | :- | :- | :- | :- | :- | :- | :- |
| title | Yes | <code>let</code> | No | -- | <code>string</code> | -- | -- |

### Slots

None.

### Events

| Event name | Type | Detail | Description |
| :- | :- | :- | :- |
| click | forwarded | -- | -- |
| close | dispatched | -- | -- |

## `RunesButton`

### Props

| Prop name | Required | Kind | Reactive | Binding | Type | Default value | Description |
| :- | :- | :- | :- | :- | :- | :- | :- |
| value | No | <code>let</code> | Yes | -- | <code>string</code> | <code>"ready"</code> | -- |
| label | Yes | <code>let</code> | No | -- | <code>string</code> | -- | -- |
| onclick | No | <code>let</code> | No | -- | <code>(event: MouseEvent) => void</code> | -- | -- |
| onpress | No | <code>let</code> | No | -- | <code>(value: string) => void</code> | -- | -- |

### Slots

| Slot name | Default | Props | Fallback | Description |
| :- | :- | :- | :- | :- |
| -- | Yes | <code>{ value: string } </code> | -- | -- |

### Events

None.

## `RunesGenericList`

### Props

| Prop name | Required | Kind | Reactive | Binding | Type | Default value | Description |
| :- | :- | :- | :- | :- | :- | :- | :- |
| items | Yes | <code>let</code> | No | -- | <code>Item[]</code> | -- | -- |
| row | Yes | <code>let</code> | No | -- | <code>Snippet<[item: Item]></code> | -- | -- |

### Slots

None.

### Events

None.

