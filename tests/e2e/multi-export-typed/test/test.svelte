<script>
  import { Button, Link, Quote, SecondaryButton } from "../src";
  import SecondaryButtonFile from "../types/SecondaryButton.svelte";
</script>

<Button
  style="color: red"
  primary={false}
  on:click={(e) => {
    console.log(e);
  }}
>
  Text
</Button>

<Link
  style="color: red"
  href="#"
  >Text</Link
>

<Quote author={"author"} />

<SecondaryButton primary={false} />
<SecondaryButtonFile primary={false} />
