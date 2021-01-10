<script lang="ts">
  import { Button, Link, Quote } from "../";
  import Button2 from "../types/button/button";
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

<Link style="color: red" href="#">Text</Link>

<Quote author={'author'} />
