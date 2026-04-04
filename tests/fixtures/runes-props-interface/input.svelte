<script lang="ts">
  interface Props {
    foo: string;
    bar?: number;
  }

  let { foo, bar }: Props = $props();
</script>

<p>{foo} {bar}</p>
