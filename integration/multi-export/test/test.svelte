<script lang="ts">
  import { Button, Link, Quote } from "../src";
</script>

<Button
  style="color: red"
  primary={false}
  on:click={(e) => {
    console.log(e);
  }}>
  Text
</Button>

<Link style="color: red" href="#">Text</Link>

<Quote author={'author'} />
