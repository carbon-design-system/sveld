<script lang="ts">
  import { LegacyPanel, RunesButton, RunesGenericList } from "../types";

  interface Todo {
    id: number;
    label: string;
  }

  const todos: Todo[] = [{ id: 1, label: "Write generics support" }];

  let value = $state("ready");
</script>

<RunesButton
  label="Click me"
  bind:value
  onclick={(event) => console.log(event.clientX)}
  onpress={(pressedValue) => console.log(pressedValue.toUpperCase())}
/>

<LegacyPanel
  title="Settings"
  onclose={(event) => console.log(event.detail.reason)}
  onclick={(event) => console.log(event.clientX)}
/>

<RunesGenericList items={todos}>
  {#snippet row(todo)}
    <span>{todo.label}</span>
  {/snippet}
</RunesGenericList>
