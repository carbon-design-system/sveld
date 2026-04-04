<script lang="ts">
  interface Props {
    item: string;
    disabled?: boolean;
    children?: import("svelte").Snippet<[props: { item: string }]>;
  }

  let props: Props = $props();
</script>

<button disabled={props.disabled}>
  {@render props.children?.({ item: props.item })}
</button>
