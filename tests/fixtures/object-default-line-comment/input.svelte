<script>
  /** Spacing scale */
  export let spacing = {
    small: 4, // px
    large: 16 /* px */,
  };

  /** Breakpoints */
  export let breakpoints = [
    320, // phone
    768,
  ];
</script>

<div>{spacing.small} {breakpoints.length}</div>
