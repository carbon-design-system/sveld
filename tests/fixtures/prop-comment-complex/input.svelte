<script>
  /**
   * Specify the switch text.
   * Alternatively, use the default slot.
   * @example
   * ```svelte
   * <Switch>
   *   <span>Custom Text</span>
   * </Switch>
   * ```
   */
  export let text = "";

  /**
   * Specify the icon to render.
   * Alternatively, use the named slot "icon".
   *
   * @type {any}
   * @example
   * ```svelte
   * <Button>
   *   <Icon slot="icon" size={20} />
   * </Button>
   * ```
   */
  export let icon = undefined;
</script>

<slot {text} {icon} />
