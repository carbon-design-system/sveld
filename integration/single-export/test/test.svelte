<script lang="ts">
  import Button from "../component";
</script>

<Button
  style="color: red"
  primary={false}
  on:click={(e) => {
    console.log(e);
  }}>
  Text
</Button>
