<script>
  import { getContext, setContext } from "svelte";

  export let dense = false;

  const parent = getContext("Group");

  /** @returns {string} */
  function nextId() {
    return "id";
  }

  setContext("Group", {
    // Inferred like a prop default.
    size: dense ? "sm" : "md",
    label: `group-${nextId()}`,
    id: nextId(),
    // Read off an untyped `getContext`: reported, then `any`.
    inherited: parent?.size ?? "md",
  });
</script>

<slot />
