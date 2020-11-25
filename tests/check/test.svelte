<script lang="ts">
  import { Button, Header, Link, Quote } from "./index";
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

<Header
  style="color: red;"
  on:load={(e) => {
    console.log(e.detail.ts);
  }}
  on:click={(e) => {
    console.log(e);
  }}
  let:prop>
  {prop}
</Header>
