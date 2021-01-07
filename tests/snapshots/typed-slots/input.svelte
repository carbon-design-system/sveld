<script>
  /**
   * @slot {{ prop: number; doubled: number; }}
   * @slot {{ props: { class?: string; } }} description
   */

  export let prop = 0;
</script>

<h1>
  <slot {prop} doubled={prop * 2} />
</h1>

<p>
  <slot name="description" props={{ class: $$props.class }} />
</p>
