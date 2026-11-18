<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    onclick,
    children,
    ...rest
  }: {
    onclick: () => void;
    children?: Snippet;
  } = $props();
</script>

{#snippet trigger<T extends () => void>(handler: T)}
  <button onclick={handler}>{@render children?.()}</button>
{/snippet}

{#snippet triggers<T extends Array<() => void>>(handlers: T)}
  {#each handlers as handler}
    {@render trigger(handler)}
  {/each}
{/snippet}

<div {...rest}>
  {@render triggers([onclick])}
</div>
