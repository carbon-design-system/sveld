<script>
  export let text = "";
</script>

<div>
  <slot>Default text</slot>
  <slot name="text" {text}>{text}</slot>
  <slot name="subheading" {text}>{text}</slot>
  <slot name="bold heading" {text}>{text}</slot>
</div>
