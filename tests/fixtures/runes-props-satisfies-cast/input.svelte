<script lang="ts">
  interface Props {
    item: string;
    disabled?: boolean;
  }
  let props = $props() satisfies Props;
</script>

<button disabled={props.disabled}>{props.item}</button>
