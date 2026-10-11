<script lang="ts">
  interface Props {
    /** The item to show. */
    item: string;
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
    /** @internal */
    secret?: string;
    /** @deprecated Use `disabled`. */
    inactive?: boolean;
    children?: import("svelte").Snippet<[props: { item: string }]>;
  }

  let props: Props = $props();
</script>

<button
  disabled={props.disabled || props.inactive}
  onclick={props.onclick}
>
  {@render props.children?.({ item: props.item })}
</button>
