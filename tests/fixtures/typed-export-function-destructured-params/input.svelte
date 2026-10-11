<script
  context="module"
  lang="ts"
>
  export function merge({ a }: { a: string }, { b }: { b: number }): string {
    return a + b;
  }
</script>

<script lang="ts">
  export function move([x, y]: [number, number], { animate }: { animate: boolean }) {
    console.log(x, y, animate);
  }

  export function focus({ preventScroll }: { preventScroll: boolean }) {
    console.log(preventScroll);
  }
</script>
