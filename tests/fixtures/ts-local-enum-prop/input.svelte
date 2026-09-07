<script lang="ts">
  enum Size {
    Small = "sm",
    Large = "lg",
  }

  export let size: Size = Size.Small;
</script>

<div class="size-{size}"><slot /></div>
