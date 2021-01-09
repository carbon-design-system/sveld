<script lang="ts">
  import Button, { Button as Button2 } from "../component";
</script>

<Button
  style="color: red"
  primary={false}
  on:click={(e) => {
    console.log(e);
  }}>
  Text
</Button>

<Button2
  style="color: red"
  primary={false}
  on:click={(e) => {
    console.log(e);
  }}>
  Text
</Button2>
