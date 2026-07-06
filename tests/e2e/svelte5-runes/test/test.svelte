<script lang="ts">
  import { RunesGenericList } from "../src";

  interface Todo {
    id: number;
    label: string;
  }

  const todos: Todo[] = [{ id: 1, label: "Write generics support" }];
</script>

<RunesGenericList items={todos}>
  {#snippet row(todo)}
    <span>{todo.label}</span>
  {/snippet}
</RunesGenericList>
