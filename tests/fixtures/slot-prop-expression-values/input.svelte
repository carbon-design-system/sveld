<script>
  export let title = "";
  export let count = 0;
</script>

<slot
  heading={title}
  {count}
  kind={"primary"}
  size={2}
  static="text"
/>
