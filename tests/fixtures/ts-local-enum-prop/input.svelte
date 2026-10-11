<script lang="ts">
  enum Size {
    Small = "sm",
    Large = "lg",
  }

  const enum Density {
    Compact = "compact",
    Comfortable = "comfortable",
  }

  export let size: Size = Size.Small;
  export let density: Density = Density.Compact;
</script>

<div class="size-{size}"><slot /></div>
