<script>
  /** Set to `true` to use the vertical variant */
  export let vertical = false;

  /** Specify the number of steps to render */
  export let count = 4;
</script>

<ul
  class:bx--progress={true}
  class:bx--progress--vertical={vertical}
  class:bx--skeleton={true}
  {...$$restProps}
  on:click
  on:mouseover
  on:mouseenter
  on:mouseleave
>
  {#each Array.from({ length: count }, (_, i) => i) as item, i (item)}
    <li class:bx--progress-step={true} class:bx--progress-step--incomplete={true}>
      <div class:bx--progress-step-button={true} class:bx--progress-step-button--unclickable={true}>
        <svg>
          <path d="M 7, 7 m -7, 0 a 7,7 0 1,0 14,0 a 7,7 0 1,0 -14,0" />
        </svg>
        <p class:bx--progress-label={true} />
        <span class:bx--progress-line={true} />
      </div>
    </li>
  {/each}
</ul>
