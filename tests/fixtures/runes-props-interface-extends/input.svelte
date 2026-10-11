<script lang="ts">
  interface Identified<Id> {
    /** Unique id. */
    id: Id;
    /** Shown when `label` is empty. */
    fallback?: string;
  }

  interface Labeled {
    label?: string;
  }

  interface Props extends Identified<number>, Labeled {
    /** Overrides the inherited docs. */
    fallback?: string;
  }

  let { id, label = "", fallback = "" }: Props = $props();
</script>

<p {id}>{label || fallback}</p>
