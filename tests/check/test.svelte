<script lang="ts">
  import { Button, Link, Quote } from ".";
</script>

<Button class="" style="" on:click primary={false} />

<Link
  class=""
  style=""
  href="/"
  on:click={(e) => {
    e.preventDefault();
  }}>
  Link text
</Link>

<Quote
  data-test
  class=""
  style=""
  quote="Quote"
  author="Author"
  on:load={({ detail }) => {
    console.log(detail);
  }} />
