<script
  context="module"
  lang="ts"
>
  export function wrap<T>(value: T): T[] {
    return [value];
  }
</script>

<script lang="ts">
  interface Item {
    id: string;
  }

  /** Maps a value. */
  export function map<V>(v: V): V {
    return v;
  }

  export function pick<K extends keyof Item = "id">(item: Item, key: K): Item[K] {
    return item[key];
  }
</script>
