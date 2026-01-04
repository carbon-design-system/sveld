<script>
  /**
   * Template literal with call expression
   */
  export let id = `ccs-${Math.random().toString(36)}`;
  
  /**
   * Static template literals
   */
  export let prefix = `prefix-`;
  export let suffix = `-suffix`;
  
  /**
   * Template literal with multiple expressions
   */
  export let message = `Hello, ${"world"}! Count: ${42}`;
</script>

<div id={id} data-prefix={prefix} data-suffix={suffix}>
  {message}
</div>

