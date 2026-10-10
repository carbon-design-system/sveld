<script>
  export let svgRef = null;
  export let pathRef = null;
  export let svgLinkRef = null;
  export let embeddedLinkRef = null;
  export let linkRef = null;
</script>

<svg bind:this={svgRef}>
  <path bind:this={pathRef} />
  <a
    bind:this={svgLinkRef}
    href="/"
  >
    <circle />
  </a>
  <foreignObject>
    <a
      bind:this={embeddedLinkRef}
      href="/"
    >
      Home
    </a>
  </foreignObject>
</svg>
<a
  bind:this={linkRef}
  href="/"
>
  Home
</a>
