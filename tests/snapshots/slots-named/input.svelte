<script>
  export let text = "";
</script>

<div>
  <slot>Default text</slot>
  <slot name="text" {text}>{text}</slot>
</div>
