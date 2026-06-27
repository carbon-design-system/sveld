<script lang="ts">
  let {
    /**
     * Whether the disclosure is open.
     * @since 2.0.0
     * @example
     * ```svelte
     * <Disclosure open />
     * ```
     */
    open = false,
  } = $props();
</script>

<details {open}><slot /></details>
