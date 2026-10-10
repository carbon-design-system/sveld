<script lang="ts">
  export let sizes = { sm: false, md: true } as const;
  export let items = ["a", "b"] as const;
  export let nested = { steps: [1, 2] } as const;
  export let size = "sm" as const;
  export let widened = { sm: false };
  export const ids = { close: "close" } as const;
</script>
